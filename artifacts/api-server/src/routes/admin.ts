import { Router, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { bookingsTable, siblingsTable, notificationEmailsTable } from "@workspace/db";
import {
  ListAdminBookingsQueryParams,
  UpdateAdminBookingBody,
  AdminLoginBody,
  ExportBookingsQueryParams,
  AddNotificationEmailBody,
} from "@workspace/api-zod";
import { eq, and, count, desc } from "drizzle-orm";
import * as XLSX from "xlsx";

type ListParams = ReturnType<typeof ListAdminBookingsQueryParams.parse>;
type ExportParams = ReturnType<typeof ExportBookingsQueryParams.parse>;

const router = Router();

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "louisenlund2026";
const SESSION_TOKEN = "admin_session";

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.[SESSION_TOKEN];
  if (token !== "authenticated") {
    res.status(401).json({ error: "Nicht angemeldet" });
    return;
  }
  next();
}

const zoneLabels: Record<string, string> = {
  zone1: "Tarifzone 1",
  zone2: "Tarifzone 2",
  zone3: "Tarifzone 3",
  none: "Keine",
};
const typeLabels: Record<string, string> = {
  full_year: "Gesamtes Schuljahr 2026/27",
  first_half: "1. Schulhalbjahr 2026/27",
};
const statusLabels: Record<string, string> = {
  received: "Eingegangen",
  reviewed: "Geprüft",
  confirmed: "Bestätigt",
  query_open: "Rückfrage offen",
};

router.post("/admin/login", (req, res) => {
  const parsed = AdminLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Ungültige Eingabe" });
    return;
  }
  if (parsed.data.password !== ADMIN_PASSWORD) {
    res.status(401).json({ error: "Falsches Passwort" });
    return;
  }
  res.cookie(SESSION_TOKEN, "authenticated", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 24 * 60 * 60 * 1000,
  });
  res.json({ authenticated: true, username: "Administrator" });
});

router.post("/admin/logout", (req, res) => {
  res.clearCookie(SESSION_TOKEN);
  res.json({ authenticated: false });
});

router.get("/admin/me", (req, res) => {
  const token = req.cookies?.[SESSION_TOKEN];
  if (token === "authenticated") {
    res.json({ authenticated: true, username: "Administrator" });
  } else {
    res.status(401).json({ authenticated: false });
  }
});

router.get("/admin/stats", requireAuth, async (req, res) => {
  const [totalResult] = await db.select({ total: count() }).from(bookingsTable);
  const total = totalResult?.total ?? 0;

  const byStatusRows = await db
    .select({ status: bookingsTable.status, cnt: count() })
    .from(bookingsTable)
    .groupBy(bookingsTable.status);
  const byStatus: Record<string, number> = {};
  for (const r of byStatusRows) byStatus[r.status] = Number(r.cnt);

  const byZoneRows = await db
    .select({ zone: bookingsTable.tariffZone, cnt: count() })
    .from(bookingsTable)
    .groupBy(bookingsTable.tariffZone);
  const byTariffZone: Record<string, number> = {};
  for (const r of byZoneRows) byTariffZone[r.zone] = Number(r.cnt);

  const byTypeRows = await db
    .select({ type: bookingsTable.bookingType, cnt: count() })
    .from(bookingsTable)
    .groupBy(bookingsTable.bookingType);
  const byBookingType: Record<string, number> = {};
  for (const r of byTypeRows) byBookingType[r.type] = Number(r.cnt);

  const byGradeRows = await db
    .select({ grade: bookingsTable.gradeYear, cnt: count() })
    .from(bookingsTable)
    .groupBy(bookingsTable.gradeYear);
  const byGradeYear: Record<string, number> = {};
  for (const r of byGradeRows) byGradeYear[r.grade] = Number(r.cnt);

  const [siblingCount] = await db.select({ total: count() }).from(siblingsTable);
  const totalChildren = total + Number(siblingCount?.total ?? 0);

  const recentRows = await db
    .select()
    .from(bookingsTable)
    .orderBy(desc(bookingsTable.createdAt))
    .limit(10);

  const siblingCounts = await db
    .select({ bookingId: siblingsTable.bookingId, cnt: count() })
    .from(siblingsTable)
    .groupBy(siblingsTable.bookingId);
  const sibCountMap: Record<number, number> = {};
  for (const r of siblingCounts) sibCountMap[r.bookingId] = Number(r.cnt);

  const recentBookings = recentRows.map((b) => ({
    id: b.id,
    referenceNumber: b.referenceNumber,
    childName: b.childName,
    gradeYear: b.gradeYear,
    parentName: b.parentName,
    parentEmail: b.parentEmail,
    parentPhone: b.parentPhone,
    tariffZone: b.tariffZone,
    bookingType: b.bookingType,
    outboundRoute: b.outboundRoute,
    returnRoute: b.returnRoute,
    status: b.status,
    createdAt: b.createdAt.toISOString(),
    siblingCount: sibCountMap[b.id] ?? 0,
  }));

  res.json({
    totalBookings: total,
    byStatus,
    byTariffZone,
    byBookingType,
    byGradeYear,
    totalChildren,
    recentBookings,
  });
});

router.get("/admin/bookings/export", requireAuth, async (req, res) => {
  const parsed = ExportBookingsQueryParams.safeParse(req.query);
  const params: ExportParams = parsed.success ? parsed.data : {};
  const format = req.query.format === "xlsx" ? "xlsx" : "csv";

  const conditions = [];
  if (params.tariffZone) conditions.push(eq(bookingsTable.tariffZone, params.tariffZone as any));
  if (params.bookingType) conditions.push(eq(bookingsTable.bookingType, params.bookingType as any));
  if (params.status) conditions.push(eq(bookingsTable.status, params.status as any));

  const rows = await db
    .select()
    .from(bookingsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(bookingsTable.createdAt));

  const siblingRows = await db.select().from(siblingsTable);
  const siblingsByBooking: Record<number, typeof siblingRows> = {};
  for (const s of siblingRows) {
    if (!siblingsByBooking[s.bookingId]) siblingsByBooking[s.bookingId] = [];
    siblingsByBooking[s.bookingId].push(s);
  }

  const siblingCounts = await db
    .select({ bookingId: siblingsTable.bookingId, cnt: count() })
    .from(siblingsTable)
    .groupBy(siblingsTable.bookingId);
  const sibCountMap: Record<number, number> = {};
  for (const r of siblingCounts) sibCountMap[r.bookingId] = Number(r.cnt);

  const headers = [
    "Referenznummer",
    "Name Kind",
    "Adresse",
    "Schülernummer",
    "Jahrgang",
    "Name Elternteil",
    "E-Mail",
    "Telefon",
    "Tarifzone",
    "Buchungsart",
    "Hinfahrt",
    "Rückfahrt",
    "Geschwisterkinder",
    "Status",
    "Notizen",
    "Eingegangen am",
  ];

  const dataRows = rows.map((b) => [
    b.referenceNumber,
    b.childName,
    b.childAddress,
    b.studentNumber ?? "",
    b.gradeYear,
    b.parentName,
    b.parentEmail,
    b.parentPhone,
    zoneLabels[b.tariffZone] ?? b.tariffZone,
    typeLabels[b.bookingType] ?? b.bookingType,
    zoneLabels[b.outboundRoute] ?? b.outboundRoute,
    zoneLabels[b.returnRoute] ?? b.returnRoute,
    String(sibCountMap[b.id] ?? 0),
    statusLabels[b.status] ?? b.status,
    b.adminNotes ?? "",
    b.createdAt.toLocaleDateString("de-DE"),
  ]);

  const filename = `regionalshuttle-buchungen-${new Date().toISOString().split("T")[0]}`;

  if (format === "xlsx") {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);

    ws["!cols"] = [
      { wch: 18 }, { wch: 28 }, { wch: 35 }, { wch: 16 }, { wch: 16 },
      { wch: 28 }, { wch: 32 }, { wch: 18 }, { wch: 14 }, { wch: 30 },
      { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 40 }, { wch: 16 },
    ];

    const headerRow = ws["1"] as Record<string, any> | undefined;
    if (!headerRow) {
      for (let c = 0; c < headers.length; c++) {
        const cell = XLSX.utils.encode_cell({ r: 0, c });
        if (ws[cell]) {
          ws[cell].s = {
            font: { bold: true, color: { rgb: "FFFFFF" } },
            fill: { patternType: "solid", fgColor: { rgb: "004289" } },
          };
        }
      }
    }

    XLSX.utils.book_append_sheet(wb, ws, "Buchungen");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}.xlsx"`);
    res.send(buf);
    return;
  }

  const csvRows = dataRows.map((row) =>
    row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")
  );
  const csv = [headers.join(";"), ...csvRows].join("\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}.csv"`);
  res.send("\uFEFF" + csv);
});

router.get("/admin/notification-emails", requireAuth, async (req, res) => {
  const emails = await db
    .select()
    .from(notificationEmailsTable)
    .orderBy(notificationEmailsTable.createdAt);
  res.json({
    emails: emails.map((e) => ({
      id: e.id,
      email: e.email,
      label: e.label,
      createdAt: e.createdAt.toISOString(),
    })),
  });
});

router.post("/admin/notification-emails", requireAuth, async (req, res) => {
  const parsed = AddNotificationEmailBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Ungültige E-Mail-Adresse" });
    return;
  }

  const existing = await db
    .select({ id: notificationEmailsTable.id })
    .from(notificationEmailsTable)
    .where(eq(notificationEmailsTable.email, parsed.data.email))
    .limit(1);

  if (existing.length > 0) {
    res.status(409).json({ error: "Diese E-Mail-Adresse ist bereits eingetragen" });
    return;
  }

  const [inserted] = await db
    .insert(notificationEmailsTable)
    .values({ email: parsed.data.email, label: parsed.data.label ?? null })
    .returning();

  res.status(201).json({
    id: inserted.id,
    email: inserted.email,
    label: inserted.label,
    createdAt: inserted.createdAt.toISOString(),
  });
});

router.delete("/admin/notification-emails/:id", requireAuth, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Ungültige ID" });
    return;
  }

  const [deleted] = await db
    .delete(notificationEmailsTable)
    .where(eq(notificationEmailsTable.id, id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "E-Mail-Adresse nicht gefunden" });
    return;
  }

  res.json({ success: true });
});

router.get("/admin/bookings", requireAuth, async (req, res) => {
  const parsed = ListAdminBookingsQueryParams.safeParse(req.query);
  const params: Partial<ListParams> = parsed.success ? parsed.data : {};

  const page = params.page ?? 1;
  const limit = params.limit ?? 50;
  const offset = (page - 1) * limit;

  const conditions = [];
  if (params.tariffZone) conditions.push(eq(bookingsTable.tariffZone, params.tariffZone as any));
  if (params.bookingType) conditions.push(eq(bookingsTable.bookingType, params.bookingType as any));
  if (params.status) conditions.push(eq(bookingsTable.status, params.status as any));
  if (params.gradeYear) conditions.push(eq(bookingsTable.gradeYear, params.gradeYear as string));
  if (params.outboundRoute) conditions.push(eq(bookingsTable.outboundRoute, params.outboundRoute as any));
  if (params.returnRoute) conditions.push(eq(bookingsTable.returnRoute, params.returnRoute as any));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ total }] = await db
    .select({ total: count() })
    .from(bookingsTable)
    .where(whereClause);

  const rows = await db
    .select()
    .from(bookingsTable)
    .where(whereClause)
    .orderBy(desc(bookingsTable.createdAt))
    .limit(limit)
    .offset(offset);

  const siblingCounts = await db
    .select({ bookingId: siblingsTable.bookingId, cnt: count() })
    .from(siblingsTable)
    .groupBy(siblingsTable.bookingId);
  const sibCountMap: Record<number, number> = {};
  for (const r of siblingCounts) sibCountMap[r.bookingId] = Number(r.cnt);

  const bookings = rows.map((b) => ({
    id: b.id,
    referenceNumber: b.referenceNumber,
    childName: b.childName,
    childAddress: b.childAddress,
    gradeYear: b.gradeYear,
    parentName: b.parentName,
    parentEmail: b.parentEmail,
    parentPhone: b.parentPhone,
    tariffZone: b.tariffZone,
    bookingType: b.bookingType,
    outboundRoute: b.outboundRoute,
    returnRoute: b.returnRoute,
    status: b.status,
    createdAt: b.createdAt.toISOString(),
    siblingCount: sibCountMap[b.id] ?? 0,
  }));

  res.json({ bookings, total: Number(total), page, limit });
});

router.delete("/admin/bookings/:id", requireAuth, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Ungültige ID" });
    return;
  }

  const [deleted] = await db
    .delete(bookingsTable)
    .where(eq(bookingsTable.id, id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Buchung nicht gefunden" });
    return;
  }

  res.json({ success: true });
});

router.get("/admin/bookings/:id", requireAuth, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Ungültige ID" });
    return;
  }

  const [booking] = await db
    .select()
    .from(bookingsTable)
    .where(eq(bookingsTable.id, id))
    .limit(1);

  if (!booking) {
    res.status(404).json({ error: "Buchung nicht gefunden" });
    return;
  }

  const siblings = await db
    .select()
    .from(siblingsTable)
    .where(eq(siblingsTable.bookingId, id));

  res.json({
    id: booking.id,
    referenceNumber: booking.referenceNumber,
    childName: booking.childName,
    childAddress: booking.childAddress,
    studentNumber: booking.studentNumber,
    gradeYear: booking.gradeYear,
    parentName: booking.parentName,
    parentEmail: booking.parentEmail,
    parentPhone: booking.parentPhone,
    tariffZone: booking.tariffZone,
    bookingType: booking.bookingType,
    outboundRoute: booking.outboundRoute,
    returnRoute: booking.returnRoute,
    signatureName: booking.signatureName,
    status: booking.status,
    adminNotes: booking.adminNotes,
    createdAt: booking.createdAt.toISOString(),
    updatedAt: booking.updatedAt.toISOString(),
    siblings: siblings.map((s) => ({
      id: s.id,
      childName: s.childName,
      studentNumber: s.studentNumber,
      gradeYear: s.gradeYear,
      outboundRoute: s.outboundRoute,
      returnRoute: s.returnRoute,
    })),
  });
});

router.patch("/admin/bookings/:id", requireAuth, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Ungültige ID" });
    return;
  }

  const parsed = UpdateAdminBookingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Ungültige Eingabe" });
    return;
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;
  if (parsed.data.adminNotes !== undefined) updates.adminNotes = parsed.data.adminNotes;

  const [updated] = await db
    .update(bookingsTable)
    .set(updates)
    .where(eq(bookingsTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Buchung nicht gefunden" });
    return;
  }

  const siblings = await db
    .select()
    .from(siblingsTable)
    .where(eq(siblingsTable.bookingId, id));

  res.json({
    id: updated.id,
    referenceNumber: updated.referenceNumber,
    childName: updated.childName,
    childAddress: updated.childAddress,
    studentNumber: updated.studentNumber,
    gradeYear: updated.gradeYear,
    parentName: updated.parentName,
    parentEmail: updated.parentEmail,
    parentPhone: updated.parentPhone,
    tariffZone: updated.tariffZone,
    bookingType: updated.bookingType,
    outboundRoute: updated.outboundRoute,
    returnRoute: updated.returnRoute,
    signatureName: updated.signatureName,
    status: updated.status,
    adminNotes: updated.adminNotes,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
    siblings: siblings.map((s) => ({
      id: s.id,
      childName: s.childName,
      studentNumber: s.studentNumber,
      gradeYear: s.gradeYear,
      outboundRoute: s.outboundRoute,
      returnRoute: s.returnRoute,
    })),
  });
});

export default router;
