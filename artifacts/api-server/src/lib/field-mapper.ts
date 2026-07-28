/**
 * Field mapper — khớp cột Excel (tên tiếng Việt, có/không dấu, khoảng trắng thừa)
 * với các trường DB chuẩn.
 *
 * Cách hoạt động:
 *   1. Normalize mỗi key: lowercase → bỏ dấu → bỏ ký tự đặc biệt → chỉ còn a-z0-9
 *   2. Thử từng alias đã normalize; trả về giá trị đầu tiên khớp.
 *
 * Ví dụ: "BTP tồn kho", " BTP Ton Kho ", "btptonkho" → đều match alias "btptonkho"
 */

// ── Normalize ─────────────────────────────────────────────────────────────────

export function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // xoá dấu tiếng Việt
    .replace(/[^a-z0-9]/g, "");      // chỉ giữ chữ-số
}

// ── Lookup helper ─────────────────────────────────────────────────────────────

/**
 * Tìm giá trị trong một row Excel theo danh sách alias.
 * Trả về giá trị đầu tiên khớp, hoặc null nếu không tìm thấy.
 */
export function pick(
  row: Record<string, unknown>,
  aliases: readonly string[],
): unknown {
  // Build normalized key → original key map (1 lần / row)
  const normalizedMap = new Map<string, unknown>();
  for (const [k, v] of Object.entries(row)) {
    normalizedMap.set(normalize(k), v);
  }
  for (const alias of aliases) {
    const val = normalizedMap.get(normalize(alias));
    if (val !== undefined) return val;
  }
  return null;
}

// ── String / Number helpers ───────────────────────────────────────────────────

export function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

export function num(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return isNaN(n) ? null : String(n);
}

export function dateStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  // xlsx với cellDates:true trả về Date object
  if (v instanceof Date) {
    return v.toISOString().slice(0, 10); // YYYY-MM-DD
  }
  // Hoặc string dạng YYYY-MM-DD / DD/MM/YYYY
  const s = String(v).trim();
  if (s === "") return null;
  // Thử parse DD/MM/YYYY
  const dmyMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmyMatch) {
    return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, "0")}-${dmyMatch[1].padStart(2, "0")}`;
  }
  return s; // Trả nguyên nếu không parse được
}

// ── Alias lists cho từng loại file ───────────────────────────────────────────

/** Các tên cột có thể gặp trong thực tế cho từng trường */
export const ALIASES = {
  // Khóa ghép chung
  khsx: ["KHSX", "Ke hoach SX", "KH SX", "Ke hoach san xuat", "KHSX Code", "KH"],
  so:   ["SO", "Sales Order", "Sale Order", "So don hang", "Don hang", "Order No", "Sales order"],
  maHang: ["Ma hang", "Ma Hang", "Mã hàng", "MH", "Ma SP", "Ma san pham", "Item Code", "Style"],
  tenHang: ["Ten hang", "Ten Hang", "Tên hàng", "Ten san pham", "Item Name", "Style Name"],
  donVi: ["Don vi", "Đơn vị", "UoM", "Unit"],
  mauSac: ["Mau sac", "Màu sắc", "Color", "Mau"],
  sizeHang: ["Size", "Size hang", "Kich co", "Kích cỡ"],

  // KE_HOACH
  soLuongKeHoach: ["So luong ke hoach", "SL ke hoach", "SL KH", "Ke hoach SL", "Quantity", "QTY", "So luong"],
  soLuongDoiHang: ["So luong doi hang", "SL doi hang", "Doi hang"],
  ngayBatDau: ["Ngay bat dau", "Ngay BĐ", "Start Date", "Tu ngay", "Begin Date"],
  ngayKetThuc: ["Ngay ket thuc", "Ngay KT", "End Date", "Den ngay", "Finish Date", "Due Date"],
  tuanKeHoach: ["Tuan ke hoach", "Tuan KH", "Week", "Tuan"],

  // SAP_EXPORT
  materialSap: ["Material SAP", "Material", "Ma vat tu SAP", "SAP Material", "Mat No", "Material No"],
  tenVatTu: ["Ten vat tu", "Tên vật tư", "Material Name", "Description"],
  nhaCungCap: ["Nha cung cap", "Nhà cung cấp", "Vendor", "Supplier"],
  btpTonKho: ["BTP ton kho", "BTP tồn kho", "Ton kho", "Stock", "On Hand", "BTP con lai"],
  btpDaXuat: ["BTP da xuat", "BTP đã xuất", "Da xuat", "Issued", "Consumed"],
  btpYeuCau: ["BTP yeu cau", "BTP yêu cầu", "Yeu cau", "Required", "Requirement"],
  btpDangCho: ["BTP dang cho", "Dang cho nhap", "In Transit", "On Order"],
  ngayXuatSap: ["Ngay xuat SAP", "Export Date", "Ngay export", "Run Date"],

  // SAN_LUONG
  ngaySanXuat: ["Ngay san xuat", "Ngày SX", "Production Date", "Date", "Ngay"],
  soLuongThucTe: ["So luong thuc te", "SL thuc te", "Actual Qty", "Actual", "Output", "San luong"],
  soLuongNgay: ["So luong ke hoach ngay", "SL KH ngay", "Daily Plan"],
  caLamViec: ["Ca lam viec", "Ca", "Shift"],
  maySanXuat: ["May san xuat", "May", "Machine", "Chuyen"],
  nguoiNhap: ["Nguoi nhap", "Người nhập", "Created By", "User"],

  // LICH_CONT
  maCont: ["Ma cont", "Mã cont", "Container No", "Cont No", "Container", "So cont"],
  ngayDongCont: ["Ngay dong cont", "Deadline Cont", "ETD", "Closing Date", "Closing", "Cont Date"],
  soLuongCont: ["So luong cont", "SL cont", "Cont Qty"],
  cangDi: ["Cang di", "Cảng đi", "Port of Loading", "POL"],
  cangDen: ["Cang den", "Cảng đến", "Port of Discharge", "POD"],
  tenTau: ["Ten tau", "Tàu", "Vessel", "Ship"],
  ghiChu: ["Ghi chu", "Ghi chú", "Note", "Remark"],

  // HTQLKHCL
  trangThaiKcs: ["Trang thai KCS", "Trạng thái KCS", "KCS Status", "QC Status"],
  soLuongKiem: ["So luong kiem", "SL kiem", "Inspected Qty"],
  soLuongDat: ["So luong dat", "SL dat", "Passed Qty", "OK Qty"],
  soLuongLoi: ["So luong loi", "SL loi", "Failed Qty", "NG Qty"],
  tyLeDat: ["Ty le dat", "Tỷ lệ đạt", "Pass Rate", "OK Rate"],
  lyDoLoi: ["Ly do loi", "Lý do lỗi", "Defect Reason", "NG Reason"],
  ngayKiem: ["Ngay kiem", "Ngày kiểm", "Inspection Date"],
  nguoiKiem: ["Nguoi kiem", "Người kiểm", "Inspector"],
} as const;
