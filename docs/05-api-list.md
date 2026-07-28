# 🔌 DANH SÁCH API DỰ KIẾN

## Quy ước chung

- Base path: `/api`
- Format: JSON
- Tất cả response đều có dạng: `{ success: boolean, data?: T, error?: string }`

---

## 1. IMPORT — Upload & Quản lý file

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| `POST` | `/api/import/upload` | Upload file Excel → parse, validate, trả về preview |
| `POST` | `/api/import/:sessionId/confirm` | Xác nhận import → lưu vào DB |
| `DELETE` | `/api/import/:sessionId` | Hủy bỏ session import (trước khi confirm) |
| `GET` | `/api/import/sessions` | Danh sách lịch sử import (phân trang) |
| `GET` | `/api/import/sessions/:sessionId` | Chi tiết 1 session import |
| `GET` | `/api/import/sessions/:sessionId/preview` | Xem dữ liệu preview trước khi confirm |

### POST `/api/import/upload`

**Request:** `multipart/form-data`
```
file: [Excel file]
file_type: 'KE_HOACH' | 'LICH_CONT' | 'SAP_EXPORT' | 'HTQLKHCL' | 'SAN_LUONG'
           (optional — hệ thống tự nhận diện nếu không truyền)
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": 42,
    "detectedType": "KE_HOACH",
    "fileName": "KH_Dap_Cuc_W27.xlsx",
    "rowCount": 150,
    "validRows": 148,
    "invalidRows": 2,
    "errors": [
      { "row": 5, "message": "Thiếu cột KHSX" }
    ],
    "preview": [
      { "khsx": "KH001", "so": "SO123", "ma_hang": "A001", "..." }
    ]
  }
}
```

---

## 2. DASHBOARD — Dữ liệu tổng quan

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| `GET` | `/api/dashboard/summary` | KPI cards: tổng mã hàng, trạng thái |
| `GET` | `/api/dashboard/cont-alert` | Danh sách cont còn <= N ngày |
| `GET` | `/api/dashboard/btp-shortage` | Danh sách mã hàng thiếu BTP |
| `GET` | `/api/dashboard/progress` | Tiến độ tổng theo trạng thái |
| `GET` | `/api/dashboard/recent-imports` | 5 lần import gần nhất |

### GET `/api/dashboard/summary`

**Response:**
```json
{
  "success": true,
  "data": {
    "tongMaHang": 250,
    "daHoanThanh": 80,
    "dangSanXuat": 120,
    "chuaBatDau": 50,
    "tyLeHoanThanh": 32.0,
    "contAlertCount": 12,
    "btpShortageCount": 8,
    "missingSapCount": 5,
    "lastUpdated": "2026-07-28T08:00:00Z"
  }
}
```

### GET `/api/dashboard/cont-alert`

**Query params:** `?days=3` (mặc định theo alert_settings)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "khsx": "KH001",
      "so": "SO123",
      "maHang": "A001",
      "tenHang": "Cúc nhựa 4 lỗ",
      "ngayDongCont": "2026-07-31",
      "soNgayConLai": 3,
      "soLuongKeHoach": 5000,
      "soLuongThucTe": 3200,
      "tyLeHoanThanh": 64.0
    }
  ]
}
```

---

## 3. TRA CỨU — Search & Detail

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| `GET` | `/api/search` | Tìm kiếm theo SO/KHSX/Material SAP/Mã hàng |
| `GET` | `/api/items/:id` | Chi tiết 1 dòng kế hoạch |

### GET `/api/search`

**Query params:**
```
q=<từ khóa>          (bắt buộc, min 2 ký tự)
type=SO|KHSX|MATERIAL|MA_HANG   (optional, mặc định tìm tất cả)
page=1
limit=20
```

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 5,
    "items": [
      {
        "id": 101,
        "khsx": "KH2026-001",
        "so": "SO-456789",
        "materialSap": "MAT-001",
        "maHang": "CUC-4L-TRG",
        "tenHang": "Cúc 4 lỗ trắng 15mm",
        "ngayDongCont": "2026-07-31",
        "soNgayConLai": 3,
        "trangThai": "DANG_SAN_XUAT",
        "tyLeHoanThanh": 64.0
      }
    ]
  }
}
```

### GET `/api/items/:id`

**Response:**
```json
{
  "success": true,
  "data": {
    "keHoach": {
      "id": 101,
      "khsx": "KH2026-001",
      "so": "SO-456789",
      "maHang": "CUC-4L-TRG",
      "tenHang": "Cúc 4 lỗ trắng 15mm",
      "soLuongKeHoach": 5000,
      "ngayBatDau": "2026-07-20",
      "ngayKetThuc": "2026-07-31",
      "trangThai": "DANG_SAN_XUAT"
    },
    "cont": {
      "ngayDongCont": "2026-07-31",
      "maCont": "CONT-2026-07-001",
      "cangDi": "Cảng Cát Lái",
      "soNgayConLai": 3
    },
    "sap": {
      "materialSap": "MAT-001",
      "btpTonKho": 3000,
      "btpYeuCau": 5000,
      "chenhLechBtp": -2000,
      "flagThieuBtp": true
    },
    "sanLuong": {
      "soLuongThucTe": 3200,
      "tyLeHoanThanh": 64.0,
      "chiTietTheoNgay": [
        { "ngay": "2026-07-20", "soLuong": 800 },
        { "ngay": "2026-07-21", "soLuong": 900 }
      ]
    },
    "kcs": {
      "trangThaiKcs": "DAT",
      "soLuongDat": 3100,
      "soLuongLoi": 100,
      "tyLeDat": 96.875
    }
  }
}
```

---

## 4. BÁO CÁO — Reports

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| `POST` | `/api/reports/generate` | Sinh báo cáo tuần |
| `GET` | `/api/reports` | Danh sách báo cáo đã tạo |
| `GET` | `/api/reports/:id/download` | Tải xuống file báo cáo (Excel/PDF) |

### POST `/api/reports/generate`

**Request:**
```json
{
  "reportType": "WEEKLY",
  "periodStart": "2026-07-21",
  "periodEnd": "2026-07-27",
  "format": "xlsx"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "reportId": 5,
    "downloadUrl": "/api/reports/5/download",
    "summary": {
      "tongKeHoach": 250,
      "tongSanLuong": 18500,
      "tyLeHoanThanh": 32.0,
      "soMaHangNguyHiem": 12,
      "soMaHangThieuBtp": 8,
      "soContSapDong": 15
    }
  }
}
```

---

## 5. CẢNH BÁO — Alerts

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| `GET` | `/api/alerts` | Danh sách cảnh báo (filter theo type/severity) |
| `PUT` | `/api/alerts/:id/read` | Đánh dấu đã đọc |
| `PUT` | `/api/alerts/read-all` | Đánh dấu tất cả đã đọc |
| `POST` | `/api/alerts/refresh` | Tính toán lại cảnh báo từ merged data |

### GET `/api/alerts`

**Query params:** `?type=CONT_DEADLINE&severity=critical&is_read=false&limit=50`

---

## 6. CÀI ĐẶT — Settings

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| `GET` | `/api/settings/alerts` | Lấy cài đặt ngưỡng cảnh báo |
| `PUT` | `/api/settings/alerts/:type` | Cập nhật ngưỡng cảnh báo |

### PUT `/api/settings/alerts/CONT_DEADLINE`

**Request:**
```json
{
  "thresholdDays": 5,
  "isEnabled": true
}
```

---

## 7. HEALTH CHECK

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| `GET` | `/api/healthz` | Kiểm tra trạng thái server |

---

## Tổng hợp API

| Nhóm | Số endpoint |
|------|-------------|
| Import | 6 |
| Dashboard | 5 |
| Tra cứu | 2 |
| Báo cáo | 3 |
| Cảnh báo | 4 |
| Cài đặt | 2 |
| Health | 1 |
| **Tổng** | **23** |
