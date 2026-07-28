import { pgTable, serial, integer, varchar, numeric, date, timestamp } from "drizzle-orm/pg-core";
import { importSessionsTable } from "./import-sessions";

export const sanLuongNhaMayTable = pgTable("san_luong_nha_may", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id")
    .notNull()
    .references(() => importSessionsTable.id, { onDelete: "cascade" }),

  // Khóa ghép
  khsx: varchar("khsx", { length: 100 }),
  so: varchar("so", { length: 100 }),
  maHang: varchar("ma_hang", { length: 100 }),

  // Sản lượng
  ngaySanXuat: date("ngay_san_xuat"),
  soLuongThucTe: numeric("so_luong_thuc_te", { precision: 15, scale: 2 }),
  soLuongKeHoach: numeric("so_luong_ke_hoach", { precision: 15, scale: 2 }),
  caLamViec: varchar("ca_lam_viec", { length: 20 }),
  maySanXuat: varchar("may_san_xuat", { length: 100 }),
  nguoiNhap: varchar("nguoi_nhap", { length: 100 }),

  rawRowIndex: integer("raw_row_index"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SanLuongNhaMay = typeof sanLuongNhaMayTable.$inferSelect;
