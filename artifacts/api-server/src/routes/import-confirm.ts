/**
 * POST /import/:sessionId/confirm
 *
 * Chuyển dữ liệu từ staging (raw_data trong import_sessions)
 * sang các bảng chính thức dựa theo file_type.
 *
 * Luồng:
 *   1. Kiểm tra session tồn tại & chưa confirmed
 *   2. Đọc raw_data (JSON rows từ Excel)
 *   3. Map field linh hoạt (xử lý tên cột tiếng Việt có/không dấu)
 *   4. Bulk insert trong transaction
 *   5. Cập nhật session: status='confirmed', raw_data=null
 */

import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  importSessionsTable,
  keHoachDapCucTable,
  sapExportTable,
  sanLuongNhaMayTable,
  lichDongContTable,
} from "@workspace/db";
import { pick, str, num, dateStr, ALIASES } from "../lib/field-mapper";

const router: IRouter = Router();

// ── Type helpers ──────────────────────────────────────────────────────────────

type RawRow = Record<string, unknown>;

// ── Mappers: Excel row → DB insert values ─────────────────────────────────────

function mapKeHoach(row: RawRow, sessionId: number) {
  return {
    sessionId,
    khsx:             str(pick(row, ALIASES.khsx)),
    so:               str(pick(row, ALIASES.so)),
    maHang:           str(pick(row, ALIASES.maHang)),
    tenHang:          str(pick(row, ALIASES.tenHang)),
    donVi:            str(pick(row, ALIASES.donVi)),
    mauSac:           str(pick(row, ALIASES.mauSac)),
    sizeHang:         str(pick(row, ALIASES.sizeHang)),
    soLuongKeHoach:   num(pick(row, ALIASES.soLuongKeHoach)),
    soLuongDoiHang:   num(pick(row, ALIASES.soLuongDoiHang)),
    ngayBatDau:       dateStr(pick(row, ALIASES.ngayBatDau)),
    ngayKetThuc:      dateStr(pick(row, ALIASES.ngayKetThuc)),
    tuanKeHoach:      str(pick(row, ALIASES.tuanKeHoach)),
    rawRowIndex:      typeof row.__rowNum__ === "number" ? row.__rowNum__ : null,
  };
}

function mapSapExport(row: RawRow, sessionId: number) {
  return {
    sessionId,
    khsx:         str(pick(row, ALIASES.khsx)),
    so:           str(pick(row, ALIASES.so)),
    materialSap:  str(pick(row, ALIASES.materialSap)),
    maHang:       str(pick(row, ALIASES.maHang)),
    tenVatTu:     str(pick(row, ALIASES.tenVatTu)),
    donVi:        str(pick(row, ALIASES.donVi)),
    nhaCungCap:   str(pick(row, ALIASES.nhaCungCap)),
    btpTonKho:    num(pick(row, ALIASES.btpTonKho)),
    btpDaXuat:    num(pick(row, ALIASES.btpDaXuat)),
    btpYeuCau:    num(pick(row, ALIASES.btpYeuCau)),
    btpDangCho:   num(pick(row, ALIASES.btpDangCho)),
    ngayXuatSap:  dateStr(pick(row, ALIASES.ngayXuatSap)),
    rawRowIndex:  typeof row.__rowNum__ === "number" ? row.__rowNum__ : null,
  };
}

function mapSanLuong(row: RawRow, sessionId: number) {
  return {
    sessionId,
    khsx:            str(pick(row, ALIASES.khsx)),
    so:              str(pick(row, ALIASES.so)),
    maHang:          str(pick(row, ALIASES.maHang)),
    ngaySanXuat:     dateStr(pick(row, ALIASES.ngaySanXuat)),
    soLuongThucTe:   num(pick(row, ALIASES.soLuongThucTe)),
    soLuongKeHoach:  num(pick(row, ALIASES.soLuongNgay)),
    caLamViec:       str(pick(row, ALIASES.caLamViec)),
    maySanXuat:      str(pick(row, ALIASES.maySanXuat)),
    nguoiNhap:       str(pick(row, ALIASES.nguoiNhap)),
    rawRowIndex:     typeof row.__rowNum__ === "number" ? row.__rowNum__ : null,
  };
}

function mapLichCont(row: RawRow, sessionId: number) {
  const ngay = dateStr(pick(row, ALIASES.ngayDongCont));
  return {
    sessionId,
    khsx:          str(pick(row, ALIASES.khsx)),
    so:            str(pick(row, ALIASES.so)),
    maHang:        str(pick(row, ALIASES.maHang)),
    maCont:        str(pick(row, ALIASES.maCont)),
    // ngayDongCont là NOT NULL trong schema — fallback '1900-01-01' thay vì crash
    ngayDongCont:  ngay ?? "1900-01-01",
    soLuongCont:   num(pick(row, ALIASES.soLuongCont)),
    cangDi:        str(pick(row, ALIASES.cangDi)),
    cangDen:       str(pick(row, ALIASES.cangDen)),
    tenTau:        str(pick(row, ALIASES.tenTau)),
    ghiChu:        str(pick(row, ALIASES.ghiChu)),
    rawRowIndex:   typeof row.__rowNum__ === "number" ? row.__rowNum__ : null,
  };
}

// ── Chunked insert: tránh "too many parameters" với file lớn ─────────────────

const CHUNK_SIZE = 500;

async function insertChunked<T extends Record<string, unknown>>(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  table: typeof keHoachDapCucTable
        | typeof sapExportTable
        | typeof sanLuongNhaMayTable
        | typeof lichDongContTable,
  rows: T[],
): Promise<number> {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (tx.insert(table) as any).values(chunk);
    inserted += chunk.length;
  }
  return inserted;
}

// ── Endpoint ──────────────────────────────────────────────────────────────────

router.post("/import/:sessionId/confirm", async (req, res): Promise<void> => {
  // Parse sessionId từ URL
  const rawId = Array.isArray(req.params.sessionId)
    ? req.params.sessionId[0]
    : req.params.sessionId;
  const sessionId = parseInt(rawId, 10);

  if (isNaN(sessionId) || sessionId <= 0) {
    res.status(400).json({ success: false, error: "sessionId không hợp lệ." });
    return;
  }

  // ── 1. Kiểm tra session ──────────────────────────────────────────────────
  const [session] = await db
    .select()
    .from(importSessionsTable)
    .where(eq(importSessionsTable.id, sessionId));

  if (!session) {
    res.status(400).json({
      success: false,
      error: `Không tìm thấy import session #${sessionId}.`,
    });
    return;
  }

  if (session.status === "confirmed") {
    res.status(400).json({
      success: false,
      error: `Session #${sessionId} đã được confirm rồi (${session.confirmedAt?.toISOString() ?? "?"}).`,
    });
    return;
  }

  if (!session.rawData || !Array.isArray(session.rawData)) {
    res.status(400).json({
      success: false,
      error: `Session #${sessionId} không có dữ liệu. Hãy upload lại file.`,
    });
    return;
  }

  const rawRows = session.rawData as RawRow[];
  const fileType = session.fileType;

  req.log.info(
    { sessionId, fileType, rowCount: rawRows.length },
    "Starting import confirm",
  );

  // ── 2. Transaction: bulk insert + cập nhật session ───────────────────────
  try {
    let insertedCount = 0;

    await db.transaction(async (tx) => {
      // Phân loại file_type và insert vào bảng phù hợp
      switch (fileType) {
        case "KE_HOACH": {
          /**
           * Ghi chú thực tế: Đơn hàng lớn tại Nhà máy Túi Tân Dĩnh
           * thường chia nhiều Outbound Delivery — nhiều dòng cùng KHSX/SO.
           * Thiết kế bảng cho phép duplicate (mỗi dòng có id riêng).
           * Không dùng onConflictDoNothing để tránh mất dữ liệu hợp lệ.
           */
          const mapped = rawRows.map((row) => mapKeHoach(row, sessionId));
          insertedCount = await insertChunked(tx, keHoachDapCucTable, mapped);
          break;
        }

        case "SAP_EXPORT": {
          const mapped = rawRows.map((row) => mapSapExport(row, sessionId));
          insertedCount = await insertChunked(tx, sapExportTable, mapped);
          break;
        }

        case "SAN_LUONG": {
          const mapped = rawRows.map((row) => mapSanLuong(row, sessionId));
          insertedCount = await insertChunked(tx, sanLuongNhaMayTable, mapped);
          break;
        }

        case "LICH_CONT": {
          const mapped = rawRows.map((row) => mapLichCont(row, sessionId));
          insertedCount = await insertChunked(tx, lichDongContTable, mapped);
          break;
        }

        case "HTQLKHCL": {
          // HTQLKHCL chưa có bảng riêng trong v1 — ghi log, không crash
          req.log.warn({ sessionId }, "HTQLKHCL confirm: bảng chưa được triển khai trong v1");
          insertedCount = 0;
          break;
        }

        default: {
          throw new Error(`Loại file không được hỗ trợ: ${fileType}`);
        }
      }

      // Cập nhật session: confirmed + xoá raw_data để giải phóng dung lượng
      await tx
        .update(importSessionsTable)
        .set({
          status: "confirmed",
          confirmedAt: new Date(),
          rawData: null,
        })
        .where(eq(importSessionsTable.id, sessionId));
    });

    req.log.info(
      { sessionId, fileType, insertedCount },
      "Import confirmed successfully",
    );

    res.status(200).json({
      success: true,
      data: {
        sessionId,
        fileType,
        insertedCount,
        confirmedAt: new Date().toISOString(),
        message: `Import thành công: ${insertedCount} dòng đã được ghi vào hệ thống.`,
      },
    });
  } catch (err) {
    // Transaction tự rollback khi throw — không cần gọi thủ công
    req.log.error({ err, sessionId, fileType }, "Import confirm failed — rolled back");

    // Cập nhật session sang trạng thái failed
    await db
      .update(importSessionsTable)
      .set({
        status: "failed",
        errorMessage: err instanceof Error ? err.message : String(err),
      })
      .where(eq(importSessionsTable.id, sessionId))
      .catch(() => {}); // best-effort, không throw thêm

    res.status(500).json({
      success: false,
      error: "Lỗi khi ghi dữ liệu vào hệ thống. Transaction đã được rollback.",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});

export default router;
