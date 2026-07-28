# 📋 PROJECT ROADMAP — Hệ thống Quản lý Kế hoạch Dập Cúc

## Tổng quan dự án

| Mục | Nội dung |
|-----|----------|
| **Tên dự án** | Hệ thống Quản lý Kế hoạch Dập Cúc (v1) |
| **Người dùng** | 1 người (Planner) |
| **Mục tiêu** | Giảm thao tác Excel thủ công, tổng hợp & kiểm tra dữ liệu từ nhiều file |
| **Phạm vi v1** | Import, Ghép dữ liệu, Dashboard, Tra cứu, Báo cáo, Cảnh báo |
| **Ngoài phạm vi** | AI lập kế hoạch, tích hợp SAP trực tiếp, nhiều tài khoản, app nhà máy |

---

## Nguyên tắc thiết kế

- Excel vẫn là công cụ chính của công ty — website CHỈ đọc dữ liệu từ file Excel.
- Không thay đổi quy trình làm việc hiện tại.
- Mục tiêu: thay thế SUMIFS / VLOOKUP / Copy-Paste và việc mở nhiều file cùng lúc.

---

## Các module chính

```
┌─────────────────────────────────────────────────────────┐
│                   PLANNER (1 người dùng)                │
├─────────┬──────────┬──────────┬────────────┬────────────┤
│ IMPORT  │ DASHBOARD│ TRA CỨU  │ BÁO CÁO    │ CẢNH BÁO  │
└─────────┴──────────┴──────────┴────────────┴────────────┘
```

---

## VERSION 1 — Chi tiết tính năng

### PHASE 1 — Nền tảng (Import & Ghép dữ liệu)

| # | Tính năng | Mô tả |
|---|-----------|-------|
| 1.1 | Upload file Excel | Hỗ trợ .xlsx, .xls |
| 1.2 | Nhận diện loại file | Tự động xác định 5 loại file |
| 1.3 | Kiểm tra cấu trúc | Báo lỗi nếu thiếu cột bắt buộc |
| 1.4 | Preview trước khi lưu | Hiển thị dữ liệu để xem trước, không lưu ngay |
| 1.5 | Xác nhận import | Planner xác nhận → lưu vào DB |
| 1.6 | Lịch sử import | Ghi log: ai upload, file gì, lúc nào, kết quả |
| 1.7 | Tự động ghép dữ liệu | Ghép theo KHSX > SO > Material SAP > Mã hàng |

**5 loại file cần import:**

| Ký hiệu | Tên file | Vai trò |
|---------|----------|---------|
| FILE_KH | Kế hoạch Dập Cúc | File chính, nguồn gốc dữ liệu |
| FILE_CONT | Lịch Đóng Cont | Ngày đóng container |
| FILE_SAP | SAP Export | BTP, tồn kho, mã vật tư |
| FILE_HTQL | HTQLKHCL | Dữ liệu chất lượng/KCS |
| FILE_SL | Sản lượng nhà máy | Sản lượng thực tế |

---

### PHASE 2 — Dashboard & Tra cứu

| # | Tính năng | Mô tả |
|---|-----------|-------|
| 2.1 | KPI Cards | Tổng mã hàng, hoàn thành, đang sản xuất, chưa bắt đầu |
| 2.2 | Danh sách Cont <= 3 ngày | Highlight đỏ, sắp xếp theo urgency |
| 2.3 | Danh sách thiếu BTP | Mã hàng có BTP SAP < yêu cầu |
| 2.4 | Tiến độ tổng | Bar/progress theo trạng thái |
| 2.5 | Lịch sử import | 5 lần import gần nhất |
| 2.6 | Ô tìm kiếm | Tìm theo SO / KHSX / Material SAP / Mã hàng |
| 2.7 | Chi tiết mã hàng | Popup/trang chi tiết đầy đủ |

---

### PHASE 3 — Báo cáo & Cảnh báo

| # | Tính năng | Mô tả |
|---|-----------|-------|
| 3.1 | Báo cáo tuần tự động | Tổng hợp tự động theo tuần |
| 3.2 | Xuất Excel | Export báo cáo ra .xlsx |
| 3.3 | Xuất PDF | Export báo cáo ra .pdf |
| 3.4 | Cảnh báo Cont sắp đóng | Mặc định <= 3 ngày, có thể thay đổi |
| 3.5 | Cảnh báo thiếu BTP | So sánh BTP SAP vs kế hoạch |
| 3.6 | Cảnh báo thiếu dữ liệu SAP | Mã hàng không tìm thấy trong SAP |
| 3.7 | Cảnh báo import lỗi | Thông báo khi file sai cấu trúc |
| 3.8 | Cài đặt ngưỡng cảnh báo | Planner tự chỉnh số ngày |

---

## Thứ tự ưu tiên xây dựng

```
Tuần 1-2:  PHASE 1 — Import + Ghép dữ liệu (nền tảng)
Tuần 3-4:  PHASE 2 — Dashboard + Tra cứu
Tuần 5:    PHASE 3 — Báo cáo + Cảnh báo
Tuần 6:    Test, chỉnh sửa theo feedback thực tế
```

---

## Công nghệ dự kiến

| Layer | Công nghệ |
|-------|-----------|
| Frontend | React + Vite + TypeScript |
| Backend | Express.js (Node.js) |
| Database | PostgreSQL + Drizzle ORM |
| Excel parsing | xlsx (SheetJS) |
| Export Excel | ExcelJS |
| Export PDF | pdfmake hoặc jsPDF |
| API contract | OpenAPI 3.0 + Zod validation |
| UI | shadcn/ui + Tailwind CSS |
