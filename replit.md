# Hệ thống Quản lý Kế hoạch Dập Cúc (v1)

Công cụ quản lý cá nhân cho Planner — đọc dữ liệu từ các file Excel, tổng hợp, kiểm tra, cảnh báo và báo cáo. Mục tiêu giảm thao tác SUMIFS/VLOOKUP/Copy-Paste và việc mở nhiều file cùng lúc.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Excel parsing: xlsx (SheetJS)
- Export: ExcelJS (xlsx), pdfmake (PDF)

## Phạm vi V1 (KHÔNG làm)

- ❌ Không AI lập kế hoạch / AI tối ưu / Chat AI
- ❌ Không tích hợp SAP trực tiếp
- ❌ Không nhiều tài khoản (1 người dùng duy nhất: Planner)
- ❌ Không ứng dụng cho nhà máy
- ✅ Excel vẫn là công cụ chính — website chỉ đọc và tổng hợp

## Where things live

- `docs/01-project-roadmap.md` — Roadmap, modules, thứ tự xây dựng
- `docs/02-database-erd.md` — ERD sơ đồ quan hệ
- `docs/03-database-schema.md` — SQL schema chi tiết 9 bảng
- `docs/04-table-relationships.md` — Quan hệ & join strategy
- `docs/05-api-list.md` — 23 API endpoints
- `docs/06-wireframes.md` — Wireframe 6 trang giao diện
- `lib/api-spec/openapi.yaml` — Nguồn gốc API contract
- `artifacts/api-server/` — Express backend

## Architecture decisions

- Excel là nguồn dữ liệu duy nhất — website không ghi ngược lại Excel.
- Dữ liệu raw từ mỗi file lưu riêng biệt theo bảng, ghép qua VIEW.
- Ghép dữ liệu ưu tiên: KHSX → SO → Material SAP → Mã hàng.
- Import theo 2 bước: upload/preview → xác nhận → mới ghi DB.
- Không có auth/login — single user tool.

## Product

- Import 5 loại file Excel (KH Dập Cúc, Lịch Cont, SAP, HTQLKHCL, Sản lượng NM)
- Dashboard: KPIs + Cont sắp đóng + Thiếu BTP + Tiến độ
- Tra cứu theo SO/KHSX/Material SAP/Mã hàng
- Báo cáo tuần xuất Excel/PDF
- Cảnh báo: Cont deadline, thiếu BTP, missing SAP, import error

## User preferences

- Giao diện tiếng Việt
- Đơn giản, phục vụ công việc hàng ngày
- Không cần login/auth

## Gotchas

- Ghép dữ liệu là logic nghiệp vụ (không phải FK DB) — thực hiện qua VIEW/query.
- Ngưỡng cảnh báo Cont mặc định 3 ngày — Planner có thể thay đổi trong Settings.
- Luôn chạy codegen sau khi thay đổi `lib/api-spec/openapi.yaml`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- Tài liệu thiết kế đầy đủ trong thư mục `docs/`
