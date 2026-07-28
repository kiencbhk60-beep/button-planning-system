# 🗄️ DATABASE DESIGN — ERD (Entity Relationship Diagram)

## Sơ đồ quan hệ (Text ERD)

```
┌─────────────────────┐         ┌─────────────────────┐
│   import_sessions   │         │   alert_settings    │
│─────────────────────│         │─────────────────────│
│ PK id               │         │ PK id               │
│    file_type        │         │    alert_type       │
│    file_name        │         │    threshold_days   │
│    imported_at      │         │    is_enabled       │
│    row_count        │         │    updated_at       │
│    status           │         └─────────────────────┘
│    error_message    │
│    confirmed_at     │
└────────┬────────────┘
         │ 1
         │ (1 session có nhiều rows)
         │ N
┌────────▼────────────────────────────────────────────────────────────────┐
│                          ke_hoach_dap_cuc                               │
│────────────────────────────────────────────────────────────────────────│
│ PK id                                                                   │
│ FK session_id        → import_sessions.id                              │
│    khsx              (Kế hoạch sản xuất - khóa ghép chính)             │
│    so                (Sales Order)                                      │
│    ma_hang           (Mã hàng)                                          │
│    ten_hang          (Tên hàng)                                         │
│    so_luong_ke_hoach (Số lượng kế hoạch)                               │
│    ngay_bat_dau      (Ngày bắt đầu KH)                                 │
│    ngay_ket_thuc     (Ngày kết thúc KH)                                │
│    trang_thai        (Chưa bắt đầu/Đang SX/Hoàn thành)                │
│    raw_row_index     (Số dòng gốc trong Excel)                         │
│    created_at                                                           │
└────────────────────────────────────────────────────────────────────────┘
         │
         │ (ghép theo khsx > so > material_sap > ma_hang)
         │
┌────────▼─────────────────┐   ┌──────────────────────────┐
│    lich_dong_cont        │   │       sap_export         │
│──────────────────────────│   │──────────────────────────│
│ PK id                    │   │ PK id                    │
│ FK session_id            │   │ FK session_id            │
│    khsx                  │   │    khsx                  │
│    so                    │   │    so                    │
│    ma_hang               │   │    material_sap          │
│    ma_cont               │   │    ma_hang               │
│    ngay_dong_cont        │   │    ten_vat_tu            │
│    so_luong_cont         │   │    btp_ton_kho           │
│    cang_di               │   │    btp_da_xuat           │
│    ghi_chu               │   │    btp_yeu_cau           │
│    raw_row_index         │   │    don_vi                │
│    session_id            │   │    raw_row_index         │
│    created_at            │   │    created_at            │
└──────────────────────────┘   └──────────────────────────┘

┌──────────────────────────┐   ┌──────────────────────────┐
│        htqlkhcl          │   │    san_luong_nha_may     │
│──────────────────────────│   │──────────────────────────│
│ PK id                    │   │ PK id                    │
│ FK session_id            │   │ FK session_id            │
│    khsx                  │   │    khsx                  │
│    so                    │   │    so                    │
│    ma_hang               │   │    ma_hang               │
│    trang_thai_kcs        │   │    ngay_san_xuat         │
│    so_luong_dat          │   │    so_luong_thuc_te      │
│    so_luong_loi          │   │    ca_lam_viec           │
│    ty_le_dat             │   │    nguoi_nhap            │
│    ngay_kiem             │   │    raw_row_index         │
│    raw_row_index         │   │    created_at            │
│    created_at            │   └──────────────────────────┘
└──────────────────────────┘

         │ (tất cả 4 bảng phụ ghép vào ke_hoach_dap_cuc)
         ▼

┌─────────────────────────────────────────────────────────────────────────┐
│                         merged_view (VIEW)                              │
│─────────────────────────────────────────────────────────────────────────│
│   Đây là VIEW (không phải bảng) — JOIN tự động từ 5 bảng nguồn         │
│                                                                         │
│   khsx, so, material_sap, ma_hang, ten_hang                            │
│   so_luong_ke_hoach, so_luong_thuc_te, ty_le_hoan_thanh (computed)    │
│   ngay_dong_cont, so_ngay_con_lai (computed từ NOW())                  │
│   btp_ton_kho, btp_yeu_cau, chenh_lech_btp (computed)                 │
│   trang_thai_kcs, trang_thai_san_xuat                                  │
│   trang_thai_tong (computed logic)                                     │
└─────────────────────────────────────────────────────────────────────────┘

         │
         ▼

┌──────────────────────────┐   ┌──────────────────────────┐
│        alerts            │   │        reports           │
│──────────────────────────│   │──────────────────────────│
│ PK id                    │   │ PK id                    │
│    alert_type            │   │    report_type           │
│    khsx                  │   │    period_start          │
│    so                    │   │    period_end            │
│    ma_hang               │   │    generated_at          │
│    message               │   │    file_path             │
│    severity              │   │    summary_json          │
│    is_read               │   │    created_at            │
│    created_at            │   └──────────────────────────┘
└──────────────────────────┘
```

---

## Luồng dữ liệu (Data Flow)

```
[Excel Files] 
     │
     ▼ Upload
[import_sessions] ← ghi log mỗi lần import
     │
     ▼ Parse & Validate
[5 bảng raw data]
  ├── ke_hoach_dap_cuc    (FILE_KH)
  ├── lich_dong_cont      (FILE_CONT)
  ├── sap_export          (FILE_SAP)
  ├── htqlkhcl            (FILE_HTQL)
  └── san_luong_nha_may   (FILE_SL)
     │
     ▼ Auto JOIN (VIEW)
[merged_view]
     │
     ├──▶ Dashboard KPIs
     ├──▶ Search / Detail
     ├──▶ Alerts (so sánh với alert_settings)
     └──▶ Reports (export Excel/PDF)
```

---

## Chiến lược ghép dữ liệu (Join Strategy)

```
Ưu tiên ghép theo thứ tự:
  1. KHSX         (chính xác nhất)
  2. SO           (backup nếu không có KHSX)
  3. Material SAP (backup nếu không có SO)
  4. Mã hàng      (fallback cuối cùng)

Nếu không ghép được → đánh dấu: missing_match = true
→ Tạo alert: "Không tìm thấy dữ liệu SAP"
```
