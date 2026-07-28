# 🔗 QUAN HỆ GIỮA CÁC BẢNG

## Sơ đồ quan hệ tổng quát

```
import_sessions (1) ──────────────────────────────────────────── (N) ke_hoach_dap_cuc
import_sessions (1) ──────────────────────────────────────────── (N) lich_dong_cont
import_sessions (1) ──────────────────────────────────────────── (N) sap_export
import_sessions (1) ──────────────────────────────────────────── (N) htqlkhcl
import_sessions (1) ──────────────────────────────────────────── (N) san_luong_nha_may

ke_hoach_dap_cuc  ──[ghép logic theo khsx/so/ma_hang]──  lich_dong_cont
ke_hoach_dap_cuc  ──[ghép logic theo khsx/so/ma_hang]──  sap_export
ke_hoach_dap_cuc  ──[ghép logic theo khsx/so/ma_hang]──  htqlkhcl
ke_hoach_dap_cuc  ──[ghép logic theo khsx/so/ma_hang]──  san_luong_nha_may

alert_settings    ──[đọc tham số ngưỡng]──  alerts (generate)
merged_view       ──[nguồn dữ liệu]──  alerts
merged_view       ──[nguồn dữ liệu]──  reports
```

---

## Chi tiết từng quan hệ

### 1. `import_sessions` → 5 bảng raw data

| Quan hệ | Loại | Mô tả |
|---------|------|-------|
| import_sessions → ke_hoach_dap_cuc | 1:N | 1 session import có thể có N dòng kế hoạch |
| import_sessions → lich_dong_cont | 1:N | 1 session có N dòng lịch cont |
| import_sessions → sap_export | 1:N | 1 session có N dòng SAP |
| import_sessions → htqlkhcl | 1:N | 1 session có N dòng HTQL |
| import_sessions → san_luong_nha_may | 1:N | 1 session có N dòng sản lượng |

**FK constraint:** `ON DELETE CASCADE` — nếu xóa session, dữ liệu liên quan bị xóa theo.

---

### 2. Ghép logic giữa các bảng (Business Join Keys)

Đây không phải FK database thông thường — đây là **logic ghép nghiệp vụ** thực hiện trong VIEW hoặc query.

```
Thứ tự ghép (ưu tiên từ cao xuống thấp):

BƯỚC 1: Ghép theo KHSX
  ke_hoach_dap_cuc.khsx = lich_dong_cont.khsx
  ke_hoach_dap_cuc.khsx = sap_export.khsx
  ke_hoach_dap_cuc.khsx = htqlkhcl.khsx
  ke_hoach_dap_cuc.khsx = san_luong_nha_may.khsx

BƯỚC 2 (fallback): Ghép theo SO (nếu KHSX không khớp)
  ke_hoach_dap_cuc.so = lich_dong_cont.so
  ke_hoach_dap_cuc.so = sap_export.so
  ...

BƯỚC 3 (fallback): Ghép theo Material SAP
  ke_hoach_dap_cuc.ma_hang ≈ sap_export.material_sap
  (dùng hàm NORMALIZE để chuẩn hóa mã trước khi so sánh)

BƯỚC 4 (fallback cuối): Ghép theo Mã hàng
  ke_hoach_dap_cuc.ma_hang = lich_dong_cont.ma_hang
  ke_hoach_dap_cuc.ma_hang = sap_export.ma_hang
  ...

Kết quả: match_key = 'KHSX' | 'SO' | 'MATERIAL_SAP' | 'MA_HANG' | 'NO_MATCH'
```

---

### 3. `merged_view` — VIEW tổng hợp

```sql
-- Pseudo-SQL cho merged_view
CREATE VIEW merged_view AS
SELECT
  kh.id                                          AS kh_id,
  kh.khsx,
  kh.so,
  kh.ma_hang,
  kh.ten_hang,
  kh.so_luong_ke_hoach,
  kh.ngay_bat_dau,
  kh.ngay_ket_thuc,

  -- Từ lich_dong_cont
  cont.ngay_dong_cont,
  cont.ma_cont,
  cont.cang_di,
  (cont.ngay_dong_cont - CURRENT_DATE)           AS so_ngay_con_lai,

  -- Từ sap_export
  sap.material_sap,
  sap.btp_ton_kho,
  sap.btp_yeu_cau,
  (sap.btp_ton_kho - sap.btp_yeu_cau)           AS chenh_lech_btp,

  -- Từ san_luong_nha_may (SUM)
  COALESCE(sl.tong_sl_thuc_te, 0)               AS so_luong_thuc_te,
  CASE
    WHEN kh.so_luong_ke_hoach > 0
    THEN ROUND(sl.tong_sl_thuc_te / kh.so_luong_ke_hoach * 100, 1)
    ELSE 0
  END                                            AS ty_le_hoan_thanh,

  -- Từ htqlkhcl
  htql.trang_thai_kcs,
  htql.ty_le_dat,

  -- Trạng thái tổng (tính toán)
  CASE
    WHEN COALESCE(sl.tong_sl_thuc_te, 0) = 0         THEN 'CHUA_BAT_DAU'
    WHEN sl.tong_sl_thuc_te >= kh.so_luong_ke_hoach  THEN 'HOAN_THANH'
    ELSE 'DANG_SAN_XUAT'
  END                                            AS trang_thai_tong,

  -- Cờ cảnh báo
  (cont.ngay_dong_cont - CURRENT_DATE <= 3)     AS flag_cont_gap,
  (sap.btp_ton_kho < sap.btp_yeu_cau)          AS flag_thieu_btp,
  (sap.id IS NULL)                              AS flag_missing_sap

FROM ke_hoach_dap_cuc kh
LEFT JOIN lich_dong_cont cont  ON kh.khsx = cont.khsx OR kh.so = cont.so OR kh.ma_hang = cont.ma_hang
LEFT JOIN sap_export    sap   ON kh.khsx = sap.khsx  OR kh.so = sap.so  OR kh.ma_hang = sap.ma_hang
LEFT JOIN (
  SELECT khsx, so, ma_hang, SUM(so_luong_thuc_te) AS tong_sl_thuc_te
  FROM san_luong_nha_may
  GROUP BY khsx, so, ma_hang
) sl                          ON kh.khsx = sl.khsx OR kh.so = sl.so OR kh.ma_hang = sl.ma_hang
LEFT JOIN htqlkhcl      htql  ON kh.khsx = htql.khsx OR kh.so = htql.so OR kh.ma_hang = htql.ma_hang;
```

---

### 4. `alert_settings` → `alerts`

| Quan hệ | Loại | Mô tả |
|---------|------|-------|
| alert_settings → alerts | 1:N (logic) | Mỗi loại setting sinh ra nhiều alert record |

Không có FK database — alerts được tạo ra bởi backend job đọc `alert_settings.threshold_days` và so sánh với `merged_view`.

---

## Tóm tắt danh sách bảng

| # | Tên bảng | Loại | Mô tả ngắn |
|---|----------|------|------------|
| 1 | `import_sessions` | Bảng chính | Log mỗi lần import file |
| 2 | `ke_hoach_dap_cuc` | Bảng raw data | Dữ liệu từ File KH (file chính) |
| 3 | `lich_dong_cont` | Bảng raw data | Dữ liệu từ File Lịch Đóng Cont |
| 4 | `sap_export` | Bảng raw data | Dữ liệu từ File SAP Export |
| 5 | `htqlkhcl` | Bảng raw data | Dữ liệu từ File HTQLKHCL |
| 6 | `san_luong_nha_may` | Bảng raw data | Dữ liệu từ File Sản lượng NM |
| 7 | `alert_settings` | Cấu hình | Ngưỡng cảnh báo (Planner chỉnh) |
| 8 | `alerts` | Kết quả | Danh sách cảnh báo phát sinh |
| 9 | `reports` | Lịch sử | Các báo cáo đã xuất |
| 10 | `merged_view` | VIEW | Kết hợp 5 bảng raw, dùng cho hiển thị |
