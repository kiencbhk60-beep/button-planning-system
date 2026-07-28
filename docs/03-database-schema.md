# 🗃️ DATABASE SCHEMA — Chi tiết các bảng

## 1. `import_sessions` — Lịch sử import

```sql
CREATE TABLE import_sessions (
  id              SERIAL PRIMARY KEY,
  file_type       VARCHAR(20) NOT NULL,
    -- 'KE_HOACH' | 'LICH_CONT' | 'SAP_EXPORT' | 'HTQLKHCL' | 'SAN_LUONG'
  file_name       VARCHAR(255) NOT NULL,   -- Tên file gốc
  file_size_kb    INTEGER,                 -- Kích thước file (KB)
  row_count       INTEGER,                 -- Số dòng dữ liệu
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- 'pending' | 'preview' | 'confirmed' | 'failed'
  error_message   TEXT,                    -- Chi tiết lỗi nếu thất bại
  imported_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at    TIMESTAMPTZ,             -- Thời điểm Planner xác nhận
  notes           TEXT                     -- Ghi chú tùy ý
);
```

**Ràng buộc:**
- Khi `status = 'confirmed'` thì dữ liệu mới được ghi vào bảng chính.
- Khi `status = 'pending'` hoặc `'preview'` → chỉ lưu ở bảng staging tạm thời.

---

## 2. `ke_hoach_dap_cuc` — File Kế hoạch Dập Cúc (File chính)

```sql
CREATE TABLE ke_hoach_dap_cuc (
  id                  SERIAL PRIMARY KEY,
  session_id          INTEGER NOT NULL REFERENCES import_sessions(id) ON DELETE CASCADE,

  -- Khóa ghép
  khsx                VARCHAR(100),        -- Kế hoạch sản xuất
  so                  VARCHAR(100),        -- Sales Order
  ma_hang             VARCHAR(100),        -- Mã hàng

  -- Thông tin hàng hóa
  ten_hang            VARCHAR(255),        -- Tên hàng
  don_vi              VARCHAR(50),         -- Đơn vị tính
  mau_sac             VARCHAR(100),        -- Màu sắc
  size_hang           VARCHAR(100),        -- Size/kích cỡ

  -- Số lượng
  so_luong_ke_hoach   NUMERIC(15,2),       -- Số lượng theo kế hoạch
  so_luong_doi_hang   NUMERIC(15,2),       -- Số lượng đổi hàng (nếu có)

  -- Thời gian
  ngay_bat_dau        DATE,               -- Ngày bắt đầu sản xuất KH
  ngay_ket_thuc       DATE,               -- Ngày kết thúc KH (giao hàng)
  tuan_ke_hoach       VARCHAR(20),        -- Tuần kế hoạch (ví dụ: W27)

  -- Trạng thái (tính toán tự động)
  trang_thai          VARCHAR(30) DEFAULT 'CHUA_BAT_DAU',
    -- 'CHUA_BAT_DAU' | 'DANG_SAN_XUAT' | 'HOAN_THANH'

  -- Metadata
  raw_row_index       INTEGER,            -- Số dòng gốc trong Excel
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_kh_khsx ON ke_hoach_dap_cuc(khsx);
CREATE INDEX idx_kh_so ON ke_hoach_dap_cuc(so);
CREATE INDEX idx_kh_ma_hang ON ke_hoach_dap_cuc(ma_hang);
CREATE INDEX idx_kh_session ON ke_hoach_dap_cuc(session_id);
```

---

## 3. `lich_dong_cont` — File Lịch Đóng Cont

```sql
CREATE TABLE lich_dong_cont (
  id                  SERIAL PRIMARY KEY,
  session_id          INTEGER NOT NULL REFERENCES import_sessions(id) ON DELETE CASCADE,

  -- Khóa ghép
  khsx                VARCHAR(100),
  so                  VARCHAR(100),
  ma_hang             VARCHAR(100),

  -- Thông tin cont
  ma_cont             VARCHAR(100),        -- Mã/số hiệu container
  ngay_dong_cont      DATE NOT NULL,       -- Ngày đóng container
  so_luong_cont       NUMERIC(15,2),       -- Số lượng đóng trong cont
  cang_di             VARCHAR(100),        -- Cảng đi
  cang_den            VARCHAR(100),        -- Cảng đến
  ten_tau             VARCHAR(100),        -- Tên tàu
  ghi_chu             TEXT,               -- Ghi chú

  raw_row_index       INTEGER,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cont_khsx ON lich_dong_cont(khsx);
CREATE INDEX idx_cont_so ON lich_dong_cont(so);
CREATE INDEX idx_cont_ngay ON lich_dong_cont(ngay_dong_cont);
```

---

## 4. `sap_export` — File SAP Export

```sql
CREATE TABLE sap_export (
  id                  SERIAL PRIMARY KEY,
  session_id          INTEGER NOT NULL REFERENCES import_sessions(id) ON DELETE CASCADE,

  -- Khóa ghép
  khsx                VARCHAR(100),
  so                  VARCHAR(100),
  material_sap        VARCHAR(100),        -- Mã vật tư SAP
  ma_hang             VARCHAR(100),

  -- Thông tin vật tư
  ten_vat_tu          VARCHAR(255),        -- Tên vật tư
  don_vi              VARCHAR(50),         -- Đơn vị tính
  nha_cung_cap        VARCHAR(255),        -- Nhà cung cấp

  -- Số lượng BTP
  btp_ton_kho         NUMERIC(15,2) DEFAULT 0,  -- BTP tồn kho hiện tại
  btp_da_xuat         NUMERIC(15,2) DEFAULT 0,  -- BTP đã xuất dùng
  btp_yeu_cau         NUMERIC(15,2) DEFAULT 0,  -- BTP yêu cầu theo KH
  btp_dang_cho        NUMERIC(15,2) DEFAULT 0,  -- BTP đang chờ nhập

  -- Ngày
  ngay_xuat_sap       DATE,               -- Ngày export từ SAP

  raw_row_index       INTEGER,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sap_khsx ON sap_export(khsx);
CREATE INDEX idx_sap_so ON sap_export(so);
CREATE INDEX idx_sap_material ON sap_export(material_sap);
CREATE INDEX idx_sap_ma_hang ON sap_export(ma_hang);
```

---

## 5. `htqlkhcl` — File HTQLKHCL (Hệ thống Quản lý Khách hàng Chất lượng)

```sql
CREATE TABLE htqlkhcl (
  id                  SERIAL PRIMARY KEY,
  session_id          INTEGER NOT NULL REFERENCES import_sessions(id) ON DELETE CASCADE,

  -- Khóa ghép
  khsx                VARCHAR(100),
  so                  VARCHAR(100),
  ma_hang             VARCHAR(100),

  -- Kết quả KCS
  trang_thai_kcs      VARCHAR(50),         -- 'DAT' | 'KHONG_DAT' | 'CHO_KCS'
  so_luong_kiem       NUMERIC(15,2),       -- Số lượng đưa vào kiểm
  so_luong_dat        NUMERIC(15,2),       -- Số lượng đạt
  so_luong_loi        NUMERIC(15,2),       -- Số lượng lỗi
  ty_le_dat           NUMERIC(5,2),        -- Tỷ lệ đạt (%)
  ly_do_loi           TEXT,               -- Lý do lỗi (nếu có)
  ngay_kiem           DATE,               -- Ngày kiểm
  nguoi_kiem          VARCHAR(100),        -- Người kiểm

  raw_row_index       INTEGER,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_htql_khsx ON htqlkhcl(khsx);
CREATE INDEX idx_htql_so ON htqlkhcl(so);
```

---

## 6. `san_luong_nha_may` — File Sản lượng nhà máy

```sql
CREATE TABLE san_luong_nha_may (
  id                  SERIAL PRIMARY KEY,
  session_id          INTEGER NOT NULL REFERENCES import_sessions(id) ON DELETE CASCADE,

  -- Khóa ghép
  khsx                VARCHAR(100),
  so                  VARCHAR(100),
  ma_hang             VARCHAR(100),

  -- Sản lượng
  ngay_san_xuat       DATE,               -- Ngày sản xuất
  so_luong_thuc_te    NUMERIC(15,2),      -- Sản lượng thực tế
  so_luong_ke_hoach   NUMERIC(15,2),      -- Sản lượng kế hoạch ngày
  ca_lam_viec         VARCHAR(20),        -- Ca 1 / Ca 2 / Ca 3
  may_san_xuat        VARCHAR(100),       -- Máy / chuyền sản xuất
  nguoi_nhap          VARCHAR(100),       -- Người nhập liệu

  raw_row_index       INTEGER,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sl_khsx ON san_luong_nha_may(khsx);
CREATE INDEX idx_sl_so ON san_luong_nha_may(so);
CREATE INDEX idx_sl_ngay ON san_luong_nha_may(ngay_san_xuat);
```

---

## 7. `alert_settings` — Cài đặt ngưỡng cảnh báo

```sql
CREATE TABLE alert_settings (
  id              SERIAL PRIMARY KEY,
  alert_type      VARCHAR(50) UNIQUE NOT NULL,
    -- 'CONT_DEADLINE' | 'THIEU_BTP' | 'MISSING_SAP' | 'IMPORT_ERROR'
  label           VARCHAR(100),            -- Tên hiển thị
  threshold_days  INTEGER DEFAULT 3,       -- Ngưỡng số ngày (cho CONT_DEADLINE)
  threshold_pct   NUMERIC(5,2),           -- Ngưỡng phần trăm (nếu cần)
  is_enabled      BOOLEAN DEFAULT TRUE,    -- Bật/tắt cảnh báo
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Dữ liệu mặc định
INSERT INTO alert_settings (alert_type, label, threshold_days, is_enabled) VALUES
  ('CONT_DEADLINE', 'Cont sắp đóng',     3,    TRUE),
  ('THIEU_BTP',     'Thiếu BTP',         NULL, TRUE),
  ('MISSING_SAP',   'Không có dữ liệu SAP', NULL, TRUE),
  ('IMPORT_ERROR',  'Lỗi import',        NULL, TRUE);
```

---

## 8. `alerts` — Danh sách cảnh báo

```sql
CREATE TABLE alerts (
  id              SERIAL PRIMARY KEY,
  alert_type      VARCHAR(50) NOT NULL,
  severity        VARCHAR(10) NOT NULL DEFAULT 'warning',
    -- 'info' | 'warning' | 'critical'
  khsx            VARCHAR(100),
  so              VARCHAR(100),
  ma_hang         VARCHAR(100),
  message         TEXT NOT NULL,           -- Nội dung cảnh báo
  detail_json     JSONB,                  -- Chi tiết bổ sung
  is_read         BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alerts_type ON alerts(alert_type);
CREATE INDEX idx_alerts_read ON alerts(is_read);
CREATE INDEX idx_alerts_created ON alerts(created_at DESC);
```

---

## 9. `reports` — Lịch sử báo cáo

```sql
CREATE TABLE reports (
  id              SERIAL PRIMARY KEY,
  report_type     VARCHAR(50) NOT NULL DEFAULT 'WEEKLY',
    -- 'WEEKLY' | 'CUSTOM'
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  generated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  file_path       VARCHAR(500),            -- Đường dẫn file Excel/PDF đã xuất
  file_type       VARCHAR(10),             -- 'xlsx' | 'pdf'
  summary_json    JSONB,                  -- Tóm tắt số liệu
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```
