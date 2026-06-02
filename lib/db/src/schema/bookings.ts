import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tariffZoneEnum = pgEnum("tariff_zone", [
  "zone1",
  "zone2",
  "zone3",
]);

export const routeOptionEnum = pgEnum("route_option", [
  "zone1",
  "zone2",
  "zone3",
  "none",
]);

export const bookingTypeEnum = pgEnum("booking_type", [
  "full_year",
  "first_half",
]);

export const bookingStatusEnum = pgEnum("booking_status", [
  "received",
  "reviewed",
  "confirmed",
  "query_open",
]);

export const bookingsTable = pgTable("bookings", {
  id: serial("id").primaryKey(),
  referenceNumber: text("reference_number").notNull().unique(),
  childName: text("child_name").notNull(),
  childAddress: text("child_address").notNull(),
  studentNumber: text("student_number"),
  gradeYear: text("grade_year").notNull(),
  parentName: text("parent_name").notNull(),
  parentEmail: text("parent_email").notNull(),
  parentPhone: text("parent_phone").notNull(),
  tariffZone: tariffZoneEnum("tariff_zone").notNull(),
  bookingType: bookingTypeEnum("booking_type").notNull(),
  outboundRoute: routeOptionEnum("outbound_route").notNull(),
  returnRoute: routeOptionEnum("return_route").notNull(),
  confirmationAccepted: boolean("confirmation_accepted").notNull().default(false),
  signatureName: text("signature_name").notNull(),
  gdprConsent: boolean("gdpr_consent").notNull().default(false),
  status: bookingStatusEnum("status").notNull().default("received"),
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const siblingsTable = pgTable("siblings", {
  id: serial("id").primaryKey(),
  bookingId: integer("booking_id")
    .notNull()
    .references(() => bookingsTable.id, { onDelete: "cascade" }),
  childName: text("child_name").notNull(),
  studentNumber: text("student_number"),
  gradeYear: text("grade_year").notNull(),
  outboundRoute: routeOptionEnum("outbound_route").notNull(),
  returnRoute: routeOptionEnum("return_route").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const notificationEmailsTable = pgTable("notification_emails", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  label: text("label"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertBookingSchema = createInsertSchema(bookingsTable).omit({
  id: true,
  referenceNumber: true,
  status: true,
  adminNotes: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSiblingSchema = createInsertSchema(siblingsTable).omit({
  id: true,
  bookingId: true,
  createdAt: true,
});

export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookingsTable.$inferSelect;
export type InsertSibling = z.infer<typeof insertSiblingSchema>;
export type Sibling = typeof siblingsTable.$inferSelect;
