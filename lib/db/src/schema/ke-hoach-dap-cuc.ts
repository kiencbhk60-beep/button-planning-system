import { pgTable, serial, integer, varchar, numeric, date, text, timestamp } from "drizzle-orm/pg-core";
import { importSessionsTable } from "./import-sessions";

export const keHoachDapCucTable = pgTable("ke_hoach_dap_cuc", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id")
    .notNull()
    .references(() => importSessionsTable.id, { onDelete: "cascade" }),

  // Khóa ghép
  khsx: varchar("khsx", { length: 100 }),
  so: varchar("so", { length: 100 }),
  maHang: varchar("ma_hang", { length: 100 }),

  // Thông tin hàng hóa
  tenHang: varchar("ten_hang", { length: 255 }),
  donVi: varchar("don_vi", { length: 50 }),
  mauSac: varchar("mau_sac", { length: 100 }),
  sizeHang: varchar("size_hang", { length: 100 }),

  // Số lượng
  soLuongKeHoach: numeric("so_luong_ke_hoach", { precision: 15, scale: 2 }),
  soLuongDoiHang: numeric("so_luong_doi_hang", { precision: 15, scale: 2 }),

  // Thời gian
  ngayBatDau: date("ngay_bat_dau"),
  ngayKetThuc: date("ngay_ket_thuc"),
  tuanKeHoach: varchar("tuan_ke_hoach", { length: 20 }),

  // Metadata
  rawRowIndex: integer("raw_row_index"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type KeHoachDapCuc = typeof keHoachDapCucTable.$inferSelect;
