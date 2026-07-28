import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  keHoachDapCucTable,
  sapExportTable,
  sanLuongNhaMayTable,
  lichDongContTable,
} from "@workspace/db";

const router: IRouter = Router();

// -------------------------------------------------------------------
// GET /reports/dashboard
//
// Tổng hợp từ 4 bảng dữ liệu bằng CTE (Common Table Expressions):
//   1. cte_btp   — SUM BTP theo khsx/so/ma_hang (tránh duplicate khi JOIN)
//   2. cte_sl    — SUM sản lượng thực tế
//   3. cte_cont  — MIN ngày đóng cont (deadline sớm nhất)
//
// Trả về mỗi dòng kế hoạch kèm:
//   - san_luong_con_lai   = so_luong_ke_hoach - tong_san_luong
//   - is_thieu_btp_alert  = tong_btp_thu_ve < so_luong_ke_hoach
//   - is_deadline_alert   = con_lai > 0 AND deadline_cont <= NOW() + 3 ngày
// -------------------------------------------------------------------
router.get("/reports/dashboard", async (req, res): Promise<void> => {
  try {
    // --- CTE 1: Tổng BTP thu về (tồn kho + đã xuất) theo nhóm khóa ---
    const cteBtp = db
      .$with("cte_btp")
      .as(
        db
          .select({
            khsx: sapExportTable.khsx,
            so: sapExportTable.so,
            maHang: sapExportTable.maHang,
            tongBtpThuVe: sql<string>`
              SUM(COALESCE(${sapExportTable.btpTonKho}::numeric, 0)
                + COALESCE(${sapExportTable.btpDaXuat}::numeric, 0))
            `.as("tong_btp_thu_ve"),
          })
          .from(sapExportTable)
          .groupBy(sapExportTable.khsx, sapExportTable.so, sapExportTable.maHang),
      );

    // --- CTE 2: Tổng sản lượng thực tế theo nhóm khóa ---
    const cteSl = db
      .$with("cte_sl")
      .as(
        db
          .select({
            khsx: sanLuongNhaMayTable.khsx,
            so: sanLuongNhaMayTable.so,
            maHang: sanLuongNhaMayTable.maHang,
            tongSanLuong: sql<string>`
              SUM(COALESCE(${sanLuongNhaMayTable.soLuongThucTe}::numeric, 0))
            `.as("tong_san_luong"),
          })
          .from(sanLuongNhaMayTable)
          .groupBy(
            sanLuongNhaMayTable.khsx,
            sanLuongNhaMayTable.so,
            sanLuongNhaMayTable.maHang,
          ),
      );

    // --- CTE 3: Deadline cont sớm nhất theo nhóm khóa ---
    const cteCont = db
      .$with("cte_cont")
      .as(
        db
          .select({
            khsx: lichDongContTable.khsx,
            so: lichDongContTable.so,
            maHang: lichDongContTable.maHang,
            deadlineCont: sql<string>`MIN(${lichDongContTable.ngayDongCont})`.as(
              "deadline_cont",
            ),
          })
          .from(lichDongContTable)
          .groupBy(
            lichDongContTable.khsx,
            lichDongContTable.so,
            lichDongContTable.maHang,
          ),
      );

    // --- Query chính: JOIN ke_hoach với 3 CTE ---
    const rows = await db
      .with(cteBtp, cteSl, cteCont)
      .select({
        // Thông tin kế hoạch
        id: keHoachDapCucTable.id,
        khsx: keHoachDapCucTable.khsx,
        so: keHoachDapCucTable.so,
        maHang: keHoachDapCucTable.maHang,
        tenHang: keHoachDapCucTable.tenHang,
        donVi: keHoachDapCucTable.donVi,
        soLuongKeHoach: sql<string>`
          COALESCE(${keHoachDapCucTable.soLuongKeHoach}::numeric, 0)
        `.as("so_luong_ke_hoach"),
        ngayBatDau: keHoachDapCucTable.ngayBatDau,
        ngayKetThuc: keHoachDapCucTable.ngayKetThuc,
        tuanKeHoach: keHoachDapCucTable.tuanKeHoach,

        // Từ CTE BTP
        tongBtpThuVe: sql<string>`
          COALESCE(cte_btp.tong_btp_thu_ve, 0)
        `.as("tong_btp_thu_ve"),

        // Từ CTE Sản lượng
        tongSanLuong: sql<string>`
          COALESCE(cte_sl.tong_san_luong, 0)
        `.as("tong_san_luong"),

        // Từ CTE Cont
        deadlineCont: sql<string>`cte_cont.deadline_cont`.as("deadline_cont"),

        // --- Calculated fields ---
        sanLuongConLai: sql<string>`
          GREATEST(
            COALESCE(${keHoachDapCucTable.soLuongKeHoach}::numeric, 0)
            - COALESCE(cte_sl.tong_san_luong, 0),
            0
          )
        `.as("san_luong_con_lai"),

        // Cờ cảnh báo thiếu BTP
        isThieuBtpAlert: sql<boolean>`
          COALESCE(cte_btp.tong_btp_thu_ve, 0)
          < COALESCE(${keHoachDapCucTable.soLuongKeHoach}::numeric, 0)
        `.as("is_thieu_btp_alert"),

        // Cờ cảnh báo trễ deadline cont
        // Điều kiện: còn hàng chưa dập VÀ deadline <= hôm nay + 3 ngày
        isDeadlineAlert: sql<boolean>`
          (
            COALESCE(${keHoachDapCucTable.soLuongKeHoach}::numeric, 0)
            - COALESCE(cte_sl.tong_san_luong, 0)
          ) > 0
          AND cte_cont.deadline_cont IS NOT NULL
          AND cte_cont.deadline_cont <= CURRENT_DATE + INTERVAL '3 days'
        `.as("is_deadline_alert"),

        // Tỷ lệ hoàn thành (%)
        tyLeHoanThanh: sql<string>`
          CASE
            WHEN COALESCE(${keHoachDapCucTable.soLuongKeHoach}::numeric, 0) > 0
            THEN ROUND(
              COALESCE(cte_sl.tong_san_luong, 0)
              / ${keHoachDapCucTable.soLuongKeHoach}::numeric * 100,
              1
            )
            ELSE 0
          END
        `.as("ty_le_hoan_thanh"),
      })
      .from(keHoachDapCucTable)
      .leftJoin(
        sql`cte_btp`,
        sql`
          (${keHoachDapCucTable.khsx} IS NOT NULL AND cte_btp.khsx = ${keHoachDapCucTable.khsx})
          OR (${keHoachDapCucTable.so} IS NOT NULL AND cte_btp.so = ${keHoachDapCucTable.so})
          OR (${keHoachDapCucTable.maHang} IS NOT NULL AND cte_btp.ma_hang = ${keHoachDapCucTable.maHang})
        `,
      )
      .leftJoin(
        sql`cte_sl`,
        sql`
          (${keHoachDapCucTable.khsx} IS NOT NULL AND cte_sl.khsx = ${keHoachDapCucTable.khsx})
          OR (${keHoachDapCucTable.so} IS NOT NULL AND cte_sl.so = ${keHoachDapCucTable.so})
          OR (${keHoachDapCucTable.maHang} IS NOT NULL AND cte_sl.ma_hang = ${keHoachDapCucTable.maHang})
        `,
      )
      .leftJoin(
        sql`cte_cont`,
        sql`
          (${keHoachDapCucTable.khsx} IS NOT NULL AND cte_cont.khsx = ${keHoachDapCucTable.khsx})
          OR (${keHoachDapCucTable.so} IS NOT NULL AND cte_cont.so = ${keHoachDapCucTable.so})
          OR (${keHoachDapCucTable.maHang} IS NOT NULL AND cte_cont.ma_hang = ${keHoachDapCucTable.maHang})
        `,
      )
      .orderBy(
        // Ưu tiên hiển thị: deadline gần nhất lên đầu
        sql`cte_cont.deadline_cont ASC NULLS LAST`,
        keHoachDapCucTable.id,
      );

    // --- Map kết quả → parse số, boolean rõ ràng cho frontend ---
    const data = rows.map((row) => ({
      id: row.id,
      khsx: row.khsx,
      so: row.so,
      maHang: row.maHang,
      tenHang: row.tenHang,
      donVi: row.donVi,
      soLuongKeHoach: Number(row.soLuongKeHoach),
      ngayBatDau: row.ngayBatDau,
      ngayKetThuc: row.ngayKetThuc,
      tuanKeHoach: row.tuanKeHoach,
      tongBtpThuVe: Number(row.tongBtpThuVe),
      tongSanLuong: Number(row.tongSanLuong),
      deadlineCont: row.deadlineCont ?? null,
      sanLuongConLai: Number(row.sanLuongConLai),
      tyLeHoanThanh: Number(row.tyLeHoanThanh),
      isThieuBtpAlert: Boolean(row.isThieuBtpAlert),
      isDeadlineAlert: Boolean(row.isDeadlineAlert),
    }));

    // --- Tổng hợp summary cho dashboard cards ---
    const summary = {
      tongMaHang: data.length,
      daHoanThanh: data.filter((r) => r.sanLuongConLai === 0 && r.soLuongKeHoach > 0).length,
      dangSanXuat: data.filter((r) => r.tongSanLuong > 0 && r.sanLuongConLai > 0).length,
      chuaBatDau: data.filter((r) => r.tongSanLuong === 0).length,
      soMaHangThieuBtp: data.filter((r) => r.isThieuBtpAlert).length,
      soMaHangDeadlineAlert: data.filter((r) => r.isDeadlineAlert).length,
    };

    res.json({ success: true, summary, data });
  } catch (err) {
    req.log.error({ err }, "Lỗi khi tổng hợp dashboard");
    res.status(500).json({
      success: false,
      error: "Lỗi server khi tổng hợp dữ liệu dashboard",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});

export default router;
