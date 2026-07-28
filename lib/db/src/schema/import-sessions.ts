import { pgTable, serial, varchar, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const FILE_TYPES = [
  "KE_HOACH",
  "LICH_CONT",
  "SAP_EXPORT",
  "HTQLKHCL",
  "SAN_LUONG",
] as const;
export type FileType = (typeof FILE_TYPES)[number];

export const IMPORT_STATUSES = [
  "pending",
  "preview",
  "confirmed",
  "failed",
] as const;
export type ImportStatus = (typeof IMPORT_STATUSES)[number];

export const importSessionsTable = pgTable("import_sessions", {
  id: serial("id").primaryKey(),
  fileType: varchar("file_type", { length: 20 }).notNull(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  fileSizeKb: integer("file_size_kb"),
  rowCount: integer("row_count"),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  errorMessage: text("error_message"),
  importedAt: timestamp("imported_at", { withTimezone: true }).notNull().defaultNow(),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  notes: text("notes"),
});

export const insertImportSessionSchema = createInsertSchema(importSessionsTable).omit({
  id: true,
  importedAt: true,
  confirmedAt: true,
});

export const selectImportSessionSchema = createSelectSchema(importSessionsTable);

export type InsertImportSession = z.infer<typeof insertImportSessionSchema>;
export type ImportSession = typeof importSessionsTable.$inferSelect;
