import { pgTable, text, serial, timestamp, integer, boolean, numeric } from "drizzle-orm/pg-core";
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
};

export type DateOption = typeof dateOptions.$inferSelect;
export type Attendance = typeof attendances.$inferSelect & {
  responses: (typeof attendanceResponses.$inferSelect & { status: 'available' | 'maybe' | 'unavailable' })[];
};
export type Expense = typeof expenses.$inferSelect;

// Additional types for the application
export type Settlement = {
  from: string;
  to: string;
  amount: number;
};
