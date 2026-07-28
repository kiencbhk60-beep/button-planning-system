import { pgTable, serial, integer, varchar, numeric, date, text, timestamp } from "drizzle-orm/pg-core";
import { importSessionsTable } from "./import-sessions";

export const lichDongContTable = pgTable("lich_dong_cont", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id")
    .notNull()
    .references(() => importSessionsTable.id, { onDelete: "cascade" }),

  // Khóa ghép
  khsx: varchar("khsx", { length: 100 }),
  so: varchar("so", { length: 100 }),
  maHang: varchar("ma_hang", { length: 100 }),

  // Thông tin cont
  maCont: varchar("ma_cont", { length: 100 }),
  ngayDongCont: date("ngay_dong_cont").notNull(),
  soLuongCont: numeric("so_luong_cont", { precision: 15, scale: 2 }),
  cangDi: varchar("cang_di", { length: 100 }),
  cangDen: varchar("cang_den", { length: 100 }),
  tenTau: varchar("ten_tau", { length: 100 }),
  ghiChu: text("ghi_chu"),

  rawRowIndex: integer("raw_row_index"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LichDongCont = typeof lichDongContTable.$inferSelect;
