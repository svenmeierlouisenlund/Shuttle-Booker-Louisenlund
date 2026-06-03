import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  pgEnum,
  real,
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
  "waitlisted",
]);

export const bookingsTable = pgTable("bookings", {
  id: serial("id").primaryKey(),
  referenceNumber: text("reference_number").notNull().unique(),
  childName: text("child_name").notNull(),
  childAddress: text("child_address").notNull(),
  childPostalCode: text("child_postal_code").notNull().default(""),
  childCity: text("child_city").notNull().default(""),
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
  priceCents: integer("price_cents"),
  distanceKm: real("distance_km"),
  durationMinutes: integer("duration_minutes"),
  status: bookingStatusEnum("status").notNull().default("received"),
  adminNotes: text("admin_notes"),
  photoPath: text("photo_path"),
  pickupAddress: text("pickup_address"),
  pickupPostalCode: text("pickup_postal_code"),
  pickupCity: text("pickup_city"),
  pickupTariffZone: tariffZoneEnum("pickup_tariff_zone"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const siblingsTable = pgTable("siblings", {
  id: serial("id").primaryKey(),
  bookingId: integer("booking_id")
    .notNull()
    .references(() => bookingsTable.id, { onDelete: "cascade" }),
  referenceNumber: text("reference_number").notNull().unique(),
  childName: text("child_name").notNull(),
  studentNumber: text("student_number"),
  gradeYear: text("grade_year").notNull(),
  outboundRoute: routeOptionEnum("outbound_route").notNull(),
  returnRoute: routeOptionEnum("return_route").notNull(),
  priceCents: integer("price_cents"),
  photoPath: text("photo_path"),
  status: bookingStatusEnum("status").notNull().default("received"),
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
  referenceNumber: true,
  createdAt: true,
});

export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookingsTable.$inferSelect;
export type InsertSibling = z.infer<typeof insertSiblingSchema>;
export type Sibling = typeof siblingsTable.$inferSelect;

export const busesTable = pgTable("buses", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  capacity: integer("capacity").notNull().default(8),
  notes: text("notes"),
  driverName: text("driver_name"),
  driverPhone: text("driver_phone"),
  isWaitlistBus: boolean("is_waitlist_bus").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const busAssignmentsTable = pgTable("bus_assignments", {
  id: serial("id").primaryKey(),
  busId: integer("bus_id")
    .notNull()
    .references(() => busesTable.id, { onDelete: "cascade" }),
  bookingId: integer("booking_id")
    .notNull()
    .unique()
    .references(() => bookingsTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const siblingBusAssignmentsTable = pgTable("sibling_bus_assignments", {
  id: serial("id").primaryKey(),
  busId: integer("bus_id")
    .notNull()
    .references(() => busesTable.id, { onDelete: "cascade" }),
  siblingId: integer("sibling_id")
    .notNull()
    .unique()
    .references(() => siblingsTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Bus = typeof busesTable.$inferSelect;
export type BusAssignment = typeof busAssignmentsTable.$inferSelect;
export type SiblingBusAssignment = typeof siblingBusAssignmentsTable.$inferSelect;

export const userRoleEnum = pgEnum("user_role", [
  "admin",
  "buchhaltung",
  "schulbuero",
  "fahrer",
]);

export const adminUsersTable = pgTable("admin_users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull().default("schulbuero"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type AdminUser = typeof adminUsersTable.$inferSelect;

export const smtpConfigTable = pgTable("smtp_config", {
  id: integer("id").primaryKey().default(1),
  host: text("host").notNull().default(""),
  port: integer("port").notNull().default(587),
  user: text("user").notNull().default(""),
  pass: text("pass").notNull().default(""),
  fromAddress: text("from_address").notNull().default("noreply@louisenlund.de"),
  secure: boolean("secure").notNull().default(false),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type SmtpConfig = typeof smtpConfigTable.$inferSelect;

export const pricingConfigTable = pgTable("pricing_config", {
  id:                   integer("id").primaryKey().default(1),
  fullYearBothZone1:    integer("full_year_both_zone1").notNull().default(150000),
  fullYearBothZone2:    integer("full_year_both_zone2").notNull().default(280000),
  fullYearBothZone3:    integer("full_year_both_zone3").notNull().default(410000),
  fullYearOneWayZone1:  integer("full_year_one_way_zone1").notNull().default(75000),
  fullYearOneWayZone2:  integer("full_year_one_way_zone2").notNull().default(140000),
  fullYearOneWayZone3:  integer("full_year_one_way_zone3").notNull().default(205000),
  firstHalfBothZone1:   integer("first_half_both_zone1").notNull().default(85000),
  firstHalfBothZone2:   integer("first_half_both_zone2").notNull().default(155000),
  firstHalfBothZone3:   integer("first_half_both_zone3").notNull().default(230000),
  firstHalfOneWayZone1: integer("first_half_one_way_zone1").notNull().default(42500),
  firstHalfOneWayZone2: integer("first_half_one_way_zone2").notNull().default(77500),
  firstHalfOneWayZone3: integer("first_half_one_way_zone3").notNull().default(115000),
  updatedAt:            timestamp("updated_at").notNull().defaultNow(),
});

export type PricingConfig = typeof pricingConfigTable.$inferSelect;
