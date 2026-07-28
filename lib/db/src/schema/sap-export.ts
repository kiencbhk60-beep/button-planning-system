import { pgTable, serial, integer, varchar, numeric, date, timestamp } from "drizzle-orm/pg-core";
import { importSessionsTable } from "./import-sessions";

export const sapExportTable = pgTable("sap_export", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id")
    .notNull()
    .references(() => importSessionsTable.id, { onDelete: "cascade" }),

  // Khóa ghép
  khsx: varchar("khsx", { length: 100 }),
  so: varchar("so", { length: 100 }),
  materialSap: varchar("material_sap", { length: 100 }),
  maHang: varchar("ma_hang", { length: 100 }),

  // Thông tin vật tư
  tenVatTu: varchar("ten_vat_tu", { length: 255 }),
  donVi: varchar("don_vi", { length: 50 }),
  nhaCungCap: varchar("nha_cung_cap", { length: 255 }),

  // Số lượng BTP
  btpTonKho: numeric("btp_ton_kho", { precision: 15, scale: 2 }).default("0"),
  btpDaXuat: numeric("btp_da_xuat", { precision: 15, scale: 2 }).default("0"),
  btpYeuCau: numeric("btp_yeu_cau", { precision: 15, scale: 2 }).default("0"),
  btpDangCho: numeric("btp_dang_cho", { precision: 15, scale: 2 }).default("0"),

  // Ngày
  ngayXuatSap: date("ngay_xuat_sap"),

  rawRowIndex: integer("raw_row_index"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SapExport = typeof sapExportTable.$inferSelect;
