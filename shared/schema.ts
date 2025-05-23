import { pgTable, text, serial, timestamp, integer, boolean, numeric, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Events table
export const events = pgTable("events", {
  id: text("id").primaryKey().notNull(),
  title: text("title").notNull(),
  description: text("description"),
  creatorName: text("creator_name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  selectedDate: text("selected_date"),
  startTime: text("start_time"),
  endTime: text("end_time"),
  defaultStartTime: text("default_start_time"),
  defaultEndTime: text("default_end_time"),
  participantsCount: integer("participants_count").default(0),
  participants: text("participants").array(), // 精算機能で追加された参加者リスト
  memo: text("memo"), // イベントメモ
  memoLastEditedBy: text("memo_last_edited_by"), // メモ最終編集者名
  memoLastEditedAt: text("memo_last_edited_at"), // メモ最終編集日時
  memoEditLock: jsonb("memo_edit_lock") // ロック情報（JSON形式）
});

// Date options table
export const dateOptions = pgTable("date_options", {
  id: text("id").primaryKey().notNull(),
  eventId: text("event_id").notNull().references(() => events.id),
  date: text("date").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
});

// Attendances table
export const attendances = pgTable("attendances", {
  id: text("id").primaryKey().notNull(),
  eventId: text("event_id").notNull().references(() => events.id),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Attendance responses table
export const attendanceResponses = pgTable("attendance_responses", {
  id: serial("id").primaryKey(),
  attendanceId: text("attendance_id").notNull().references(() => attendances.id),
  dateOptionId: text("date_option_id").notNull().references(() => dateOptions.id),
  status: text("status").notNull(), // 'available', 'maybe', 'unavailable'
});

// Expenses table
export const expenses = pgTable("expenses", {
  id: text("id").primaryKey().notNull(),
  eventId: text("event_id").notNull().references(() => events.id),
  payerName: text("payer_name").notNull(),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  participants: text("participants").array().default([]).notNull(), // 割り勘対象者の配列
  isSharedWithAll: boolean("is_shared_with_all").default(false), // 全員割り勘フラグ
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert schemas
export const insertEventSchema = createInsertSchema(events).omit({
  id: true,
  createdAt: true,
});

export const insertDateOptionSchema = createInsertSchema(dateOptions).omit({
  id: true,
});

export const insertAttendanceSchema = createInsertSchema(attendances).omit({
  id: true,
  createdAt: true,
});

export const insertAttendanceResponseSchema = createInsertSchema(attendanceResponses).omit({
  id: true,
});

export const insertExpenseSchema = createInsertSchema(expenses).omit({
  id: true,
  createdAt: true,
});

// Type definitions
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type InsertDateOption = z.infer<typeof insertDateOptionSchema>;
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type InsertAttendanceResponse = z.infer<typeof insertAttendanceResponseSchema>;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;

export type Event = typeof events.$inferSelect & {
  dateOptions: DateOption[];
  participants?: string[]; // 精算機能で追加された参加者リスト
  memo?: string; // イベントメモ
  memoLastEditedBy?: string; // メモ最終編集者名
  memoLastEditedAt?: string; // メモ最終編集日時
  memoEditLock?: {
    lockedBy: string; // ロックを取得したユーザー名
    lockedAt: string; // ロック取得時間
    lockExpiration: string; // ロック有効期限
  };
};

export type DateOption = typeof dateOptions.$inferSelect;
export type Attendance = typeof attendances.$inferSelect & {
  responses: (typeof attendanceResponses.$inferSelect & { status: 'available' | 'maybe' | 'unavailable' })[];
};
export type Expense = typeof expenses.$inferSelect & {
  participants?: string[]; // 参加者リスト（この支出の割り勘対象者）
  isSharedWithAll?: boolean; // 全員割り勘フラグ
};

// Additional types for the application
export type Settlement = {
  from: string;
  to: string;
  amount: number;
};
