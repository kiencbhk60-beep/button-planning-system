import { Router, type IRouter } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { db } from "@workspace/db";
import { importSessionsTable, FILE_TYPES, type FileType } from "@workspace/db";

const router: IRouter = Router();

// --- Multer: lưu file vào RAM, không ghi ra ổ cứng ---
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ];
    const extOk = /\.(xlsx|xls)$/i.test(file.originalname);
    if (allowed.includes(file.mimetype) || extOk) {
      cb(null, true);
    } else {
      cb(new Error("Chỉ chấp nhận file .xlsx hoặc .xls"));
    }
  },
});

// --- Helper: trim toàn bộ key của object (xử lý file SAP có dấu cách thừa) ---
function trimObjectKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    result[key.trim()] = obj[key];
  }
  return result;
}

// --- Helper: kiểm tra một dòng có hoàn toàn trống không ---
function isBlankRow(obj: Record<string, unknown>): boolean {
  return Object.values(obj).every(
    (v) => v === null || v === undefined || String(v).trim() === "",
  );
}

// --- Helper: tự nhận diện loại file dựa trên tên file ---
function detectFileType(fileName: string): FileType | null {
  const name = fileName.toLowerCase();
  if (name.includes("ke_hoach") || name.includes("kehoach") || name.includes("kh_dap") || name.includes("dap_cuc")) {
    return "KE_HOACH";
  }
  if (name.includes("cont") || name.includes("dong_cont") || name.includes("lich_dong")) {
    return "LICH_CONT";
  }
  if (name.includes("sap") || name.includes("export_sap")) {
    return "SAP_EXPORT";
  }
  if (name.includes("htql") || name.includes("khcl") || name.includes("chat_luong")) {
    return "HTQLKHCL";
  }
  if (name.includes("san_luong") || name.includes("sanluong") || name.includes("nha_may")) {
    return "SAN_LUONG";
  }
  return null;
}

// -------------------------------------------------------------------
// POST /import/upload
// Nhận file Excel, parse, làm sạch, lưu session vào DB với status='pending'
// Trả về session_id + 5 dòng đầu để frontend preview
// -------------------------------------------------------------------
router.post(
  "/import/upload",
  upload.single("file"),
  async (req, res): Promise<void> => {
    // 1. Kiểm tra có file không
    if (!req.file) {
      res.status(400).json({
        success: false,
        error: "Không có file được gửi lên. Vui lòng chọn file .xlsx hoặc .xls.",
      });
      return;
    }

    // 2. Xác định loại file (từ form field hoặc tự nhận diện)
    let fileType: FileType;
    const rawType = (req.body as { file_type?: string }).file_type?.toUpperCase();

    if (rawType && (FILE_TYPES as readonly string[]).includes(rawType)) {
      fileType = rawType as FileType;
    } else {
      const detected = detectFileType(req.file.originalname);
      if (!detected) {
        // Không nhận diện được — vẫn cho upload, để người dùng chọn lại
        fileType = "KE_HOACH"; // fallback
      } else {
        fileType = detected;
      }
    }

    // 3. Parse Excel từ buffer trong RAM
    let rows: Record<string, unknown>[];
    try {
      const workbook = XLSX.read(req.file.buffer, { type: "buffer", cellDates: true });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        res.status(400).json({ success: false, error: "File Excel không có sheet nào." });
        return;
      }
      const sheet = workbook.Sheets[firstSheetName];
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: null,
      });

      // 4. Làm sạch: trim key + xóa dòng trống hoàn toàn
      rows = rawRows
        .map(trimObjectKeys)
        .filter((row) => !isBlankRow(row));
    } catch (err) {
      req.log.error({ err }, "Lỗi khi đọc file Excel");
      res.status(400).json({
        success: false,
        error: "Không thể đọc file. Đảm bảo file đúng định dạng .xlsx hoặc .xls.",
      });
      return;
    }

    // 5. Ghi session vào DB với status = 'pending'
    const fileSizeKb = Math.ceil(req.file.size / 1024);
    const [session] = await db
      .insert(importSessionsTable)
      .values({
        fileType,
        fileName: req.file.originalname,
        fileSizeKb,
        rowCount: rows.length,
        status: "pending",
      })
      .returning();

    req.log.info(
      { sessionId: session.id, fileType, rowCount: rows.length },
      "Import session created",
    );

    // 6. Trả về session_id + 5 dòng đầu để preview
    res.status(200).json({
      success: true,
      data: {
        sessionId: session.id,
        detectedType: fileType,
        fileName: req.file.originalname,
        fileSizeKb,
        rowCount: rows.length,
        previewData: rows.slice(0, 5),
      },
    });
  },
);

// -------------------------------------------------------------------
// GET /import/sessions — Danh sách lịch sử import
// -------------------------------------------------------------------
router.get("/import/sessions", async (req, res): Promise<void> => {
  const sessions = await db
    .select()
    .from(importSessionsTable)
    .orderBy(importSessionsTable.importedAt);

  res.json({ success: true, data: sessions });
});

export default router;
