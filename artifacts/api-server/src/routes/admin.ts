import { Router, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { bookingsTable, siblingsTable, notificationEmailsTable, smtpConfigTable } from "@workspace/db";
import {
  ListAdminBookingsQueryParams,
  UpdateAdminBookingBody,
  AdminLoginBody,
  ExportBookingsQueryParams,
  AddNotificationEmailBody,
} from "@workspace/api-zod";
import { eq, and, count, sum, desc, sql, inArray, or } from "drizzle-orm";
import * as XLSX from "xlsx";
import multer from "multer";
import { calcBookingPrice } from "../pricing.js";
import { recalcFamilyPrices } from "../services/family.js";
import { calcRouteToSchool, sleep } from "../services/routing.js";

type ListParams = ReturnType<typeof ListAdminBookingsQueryParams.parse>;
type ExportParams = ReturnType<typeof ExportBookingsQueryParams.parse>;

const router = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Disable HTTP caching for all admin routes so browsers never serve stale data
router.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  next();
});

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
    childAddress: b.childAddress ?? "",
    childPostalCode: b.childPostalCode ?? "",
    childCity: b.childCity ?? "",
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
    priceCents: b.priceCents,
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

const ZONE_MAP: Record<string, string> = {
  "Tarifzone 1": "zone1", "Tarifzone 2": "zone2", "Tarifzone 3": "zone3",
  "zone1": "zone1", "zone2": "zone2", "zone3": "zone3",
};
const ROUTE_MAP: Record<string, string> = {
  ...ZONE_MAP,
  "Keine": "none", "none": "none",
};
const BOOKING_TYPE_MAP: Record<string, string> = {
  "Gesamtes Schuljahr 2026/27": "full_year", "full_year": "full_year",
  "1. Schulhalbjahr 2026/27": "first_half", "first_half": "first_half",
};
const STATUS_IMPORT_MAP: Record<string, string> = {
  "Eingegangen": "received", "received": "received",
  "Geprüft": "reviewed", "reviewed": "reviewed",
  "Bestätigt": "confirmed", "confirmed": "confirmed",
  "Rückfrage offen": "query_open", "query_open": "query_open",
};
const GRADE_MAP: Record<string, string> = {
  "MYP 5": "MYP5", "MYP 4": "MYP4", "MYP 3": "MYP3",
  "IB Y1": "DP1", "IB Y2": "DP2",
};
function mapGrade(g: unknown): string {
  if (typeof g === "number") return `Jahrgang ${g}`;
  const s = String(g ?? "").trim();
  return GRADE_MAP[s] ?? s;
}
function cleanStr(v: unknown): string {
  return String(v ?? "").replace(/\t/g, "").trim();
}
function genRef(): string {
  return `LL-2026-${Math.floor(10000 + Math.random() * 89999)}`;
}

router.post("/admin/import", requireAuth, upload.single("file"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "Keine Datei hochgeladen" });
    return;
  }

  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(req.file.buffer, { type: "buffer" });
  } catch {
    res.status(400).json({ error: "Ungültige Excel-Datei" });
    return;
  }

  const ws = wb.Sheets[wb.SheetNames[0]];
  const allRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 }) as unknown[][];

  // ── Format detection ────────────────────────────────────────────────────────
  // New format (18 cols): Ref | Typ | Name Kind | Straße | PLZ | Wohnort | ...
  // Old format (10 cols): Name Kind | Schülernummer | Jahrgang | Straße | PLZ | Ort | Elternteil | E-Mail | Telefon | Tarifzone
  const headerRow = allRows[0] as unknown[];
  const colCount = headerRow ? headerRow.length : 0;
  const isNewFormat = colCount >= 15 || cleanStr(headerRow?.[1]).toLowerCase() === "typ";
  const rows = allRows.slice(1) as unknown[][];

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];
  const importedParentNames = new Set<string>();

  // Track last inserted main booking ID (new format: explicit Typ column; old format: by parentEmail)
  let lastMainBookingId: number | null = null;
  // Old format only: track parentEmails already seen in this import run (first = Hauptkind, rest = Geschwister)
  const seenParentEmails = new Map<string, number>(); // email → bookingId

  for (const row of rows) {
    try {
      // ── Parse row fields based on detected format ─────────────────────────
      let typ: string;
      let childName: string;
      let childAddress: string;
      let childPostalCode: string;
      let childCity: string;
      let studentNumber: string | null;
      let gradeYear: string;
      let parentName: string;
      let parentEmail: string;
      let parentPhone: string;
      let tariffZone: string;
      let bookingType: "full_year" | "first_half";
      let outboundRoute: any;
      let returnRoute: any;
      let status: any;
      let adminNotes: string;

      if (isNewFormat) {
        // New export format (18 cols):
        // 0:Ref 1:Typ 2:Name Kind 3:Straße 4:PLZ 5:Wohnort 6:Schülernummer 7:Jahrgang
        // 8:Name Elternteil 9:E-Mail 10:Telefon 11:Tarifzone 12:Buchungsart
        // 13:Hinfahrt 14:Rückfahrt 15:Status 16:Notizen 17:Eingegangen am
        typ = cleanStr((row as any)[1]).toLowerCase();
        childName = cleanStr((row as any)[2]);
        childAddress = cleanStr((row as any)[3]);
        childPostalCode = cleanStr((row as any)[4]);
        childCity = cleanStr((row as any)[5]);
        studentNumber = cleanStr((row as any)[6]) || null;
        gradeYear = mapGrade((row as any)[7]);
        parentName = cleanStr((row as any)[8]) || "Unbekannt";
        parentEmail = cleanStr((row as any)[9]);
        parentPhone = cleanStr((row as any)[10]);
        tariffZone = ZONE_MAP[cleanStr((row as any)[11])] ?? "zone1";
        bookingType = (BOOKING_TYPE_MAP[cleanStr((row as any)[12])] ?? "full_year") as "full_year" | "first_half";
        outboundRoute = (ROUTE_MAP[cleanStr((row as any)[13])] ?? tariffZone) as any;
        returnRoute = (ROUTE_MAP[cleanStr((row as any)[14])] ?? tariffZone) as any;
        // col 15 = Kosten (€) — skipped on import (recalculated)
        status = (STATUS_IMPORT_MAP[cleanStr((row as any)[16])] ?? "confirmed") as any;
        adminNotes = cleanStr((row as any)[17]) || "Importiert";
      } else {
        // Old format (10 cols):
        // 0:Name Kind 1:Schülernummer 2:Jahrgang 3:Straße 4:PLZ 5:Ort 6:Elternteil 7:E-Mail 8:Telefon 9:Tarifzone
        childName = cleanStr((row as any)[0]);
        studentNumber = cleanStr((row as any)[1]) || null;
        gradeYear = mapGrade((row as any)[2]);
        const street = cleanStr((row as any)[3]);
        childPostalCode = cleanStr((row as any)[4]);
        childCity = cleanStr((row as any)[5]);
        childAddress = street ? `${street}, ${childPostalCode} ${childCity}`.trim() : "";
        parentName = cleanStr((row as any)[6]) || "Unbekannt";
        parentEmail = cleanStr((row as any)[7]);
        parentPhone = cleanStr((row as any)[8]);
        tariffZone = ZONE_MAP[cleanStr((row as any)[9])] ?? "zone1";
        bookingType = "full_year";
        outboundRoute = tariffZone as any;
        returnRoute = tariffZone as any;
        status = "confirmed" as any;
        adminNotes = "Importiert aus Vorjahresdaten";
        // Detect siblings by parentEmail: first occurrence = Hauptkind, subsequent = Geschwister
        typ = seenParentEmails.has(parentEmail) ? "geschwister" : "hauptkind";
      }

      if (!childName) continue;

      // ── Geschwister-Zeile ────────────────────────────────────────────────
      if (typ === "geschwister") {
        const mainId = isNewFormat ? lastMainBookingId : (seenParentEmails.get(parentEmail) ?? null);
        if (mainId === null) {
          errors.push(`${childName}: Geschwister ohne vorherige Hauptbuchung übersprungen`);
          skipped++;
          continue;
        }
        // Check for duplicate sibling
        const existingSib = await db
          .select({ id: siblingsTable.id })
          .from(siblingsTable)
          .where(and(
            eq(siblingsTable.bookingId, mainId),
            eq(siblingsTable.childName, childName),
          ))
          .limit(1);
        if (existingSib.length > 0) { skipped++; continue; }

        const sibPriceCents = calcBookingPrice(tariffZone as any, bookingType, outboundRoute, returnRoute);
        await db.insert(siblingsTable).values({
          bookingId: mainId,
          childName,
          studentNumber,
          gradeYear,
          outboundRoute,
          returnRoute,
          priceCents: Math.round(sibPriceCents * 0.8), // 20% Geschwisterrabatt
        });
        importedParentNames.add(parentName);
        imported++;
        continue;
      }

      // ── Hauptkind-Zeile ─────────────────────────────────────────────────
      const existing = await db
        .select({ id: bookingsTable.id })
        .from(bookingsTable)
        .where(and(
          eq(bookingsTable.childName, childName),
          eq(bookingsTable.parentEmail, parentEmail)
        ))
        .limit(1);

      if (existing.length > 0) {
        lastMainBookingId = existing[0].id;
        if (!isNewFormat) seenParentEmails.set(parentEmail, existing[0].id);
        skipped++;
        continue;
      }

      let ref = genRef();
      while ((await db.select({ id: bookingsTable.id }).from(bookingsTable).where(eq(bookingsTable.referenceNumber, ref)).limit(1)).length > 0) {
        ref = genRef();
      }

      const priceCents = calcBookingPrice(tariffZone as any, bookingType, outboundRoute, returnRoute);

      const [inserted] = await db.insert(bookingsTable).values({
        referenceNumber: ref,
        childName,
        childAddress,
        childPostalCode,
        childCity,
        studentNumber,
        gradeYear,
        parentName,
        parentEmail,
        parentPhone,
        tariffZone: tariffZone as any,
        bookingType,
        outboundRoute,
        returnRoute,
        signatureName: parentName,
        status,
        priceCents,
        adminNotes,
      }).returning({ id: bookingsTable.id });

      lastMainBookingId = inserted.id;
      if (!isNewFormat) seenParentEmails.set(parentEmail, inserted.id);
      importedParentNames.add(parentName);
      imported++;
    } catch (err: any) {
      const childName = cleanStr((row as any)[isNewFormat ? 2 : 0]);
      errors.push(`${childName || "Zeile"}: ${err.message ?? "Fehler"}`);
    }
  }

  // Recalculate sibling discounts for all affected families
  for (const parentName of importedParentNames) {
    await recalcFamilyPrices(parentName);
  }

  res.json({ imported, skipped, total: imported + skipped, errors });
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

  const exportBookingIds = rows.map((b) => b.id);
  const siblingRows = exportBookingIds.length > 0
    ? await db.select().from(siblingsTable).where(inArray(siblingsTable.bookingId, exportBookingIds))
    : [];
  const siblingsByBooking: Record<number, typeof siblingRows> = {};
  for (const s of siblingRows) {
    if (!siblingsByBooking[s.bookingId]) siblingsByBooking[s.bookingId] = [];
    siblingsByBooking[s.bookingId].push(s);
  }

  const headers = [
    "Referenznummer",
    "Typ",
    "Name Kind",
    "Straße",
    "PLZ",
    "Wohnort",
    "Schülernummer",
    "Jahrgang",
    "Name Elternteil",
    "E-Mail",
    "Telefon",
    "Tarifzone",
    "Buchungsart",
    "Hinfahrt",
    "Rückfahrt",
    "Kosten (€)",
    "Status",
    "Notizen",
    "Eingegangen am",
  ];

  const dataRows: (string | number | null)[][] = [];
  for (const b of rows) {
    // Main booking row
    dataRows.push([
      b.referenceNumber,
      "Hauptkind",
      b.childName,
      b.childAddress,
      b.childPostalCode ?? "",
      b.childCity ?? "",
      b.studentNumber ?? "",
      b.gradeYear,
      b.parentName,
      b.parentEmail,
      b.parentPhone,
      zoneLabels[b.tariffZone] ?? b.tariffZone,
      typeLabels[b.bookingType] ?? b.bookingType,
      zoneLabels[b.outboundRoute] ?? b.outboundRoute,
      zoneLabels[b.returnRoute] ?? b.returnRoute,
      b.priceCents != null ? b.priceCents / 100 : "",
      statusLabels[b.status] ?? b.status,
      b.adminNotes ?? "",
      b.createdAt.toLocaleDateString("de-DE"),
    ]);
    // Sibling rows
    for (const s of siblingsByBooking[b.id] ?? []) {
      dataRows.push([
        b.referenceNumber,
        "Geschwister",
        s.childName,
        b.childAddress,
        b.childPostalCode ?? "",
        b.childCity ?? "",
        s.studentNumber ?? "",
        s.gradeYear,
        b.parentName,
        b.parentEmail,
        b.parentPhone,
        zoneLabels[b.tariffZone] ?? b.tariffZone,
        typeLabels[b.bookingType] ?? b.bookingType,
        zoneLabels[s.outboundRoute] ?? s.outboundRoute,
        zoneLabels[s.returnRoute] ?? s.returnRoute,
        s.priceCents != null ? s.priceCents / 100 : "",
        statusLabels[b.status] ?? b.status,
        b.adminNotes ?? "",
        b.createdAt.toLocaleDateString("de-DE"),
      ]);
    }
  }

  const filename = `regionalshuttle-buchungen-${new Date().toISOString().split("T")[0]}`;

  if (format === "xlsx") {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);

    ws["!cols"] = [
      { wch: 18 }, { wch: 12 }, { wch: 28 }, { wch: 35 }, { wch: 8 }, { wch: 18 },
      { wch: 14 }, { wch: 12 }, { wch: 28 }, { wch: 30 }, { wch: 16 },
      { wch: 14 }, { wch: 32 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 18 }, { wch: 40 }, { wch: 16 },
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
  if (params.gradeYear) {
    // Match bookings where main child OR any sibling is in the requested grade year
    conditions.push(
      or(
        eq(bookingsTable.gradeYear, params.gradeYear as string),
        sql`EXISTS (SELECT 1 FROM siblings WHERE siblings.booking_id = ${bookingsTable.id} AND siblings.grade_year = ${params.gradeYear})`,
      )!,
    );
  }
  if (params.outboundRoute) conditions.push(eq(bookingsTable.outboundRoute, params.outboundRoute as any));
  if (params.returnRoute) conditions.push(eq(bookingsTable.returnRoute, params.returnRoute as any));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ total, totalPriceCents }] = await db
    .select({ total: count(), totalPriceCents: sum(bookingsTable.priceCents) })
    .from(bookingsTable)
    .where(whereClause);

  // Also sum sibling prices for all matching bookings (not just current page)
  const siblingTotalResult = await db
    .select({ siblingPriceCents: sum(siblingsTable.priceCents) })
    .from(siblingsTable)
    .innerJoin(bookingsTable, eq(siblingsTable.bookingId, bookingsTable.id))
    .where(whereClause);
  const siblingTotalCents = Number(siblingTotalResult[0]?.siblingPriceCents ?? 0);

  const rows = await db
    .select()
    .from(bookingsTable)
    .where(whereClause)
    .orderBy(desc(bookingsTable.createdAt))
    .limit(limit)
    .offset(offset);

  // Fetch all siblings for the returned bookings in one query
  const bookingIds = rows.map((b) => b.id);
  const allSiblings = bookingIds.length > 0
    ? await db.select().from(siblingsTable).where(inArray(siblingsTable.bookingId, bookingIds))
    : [];
  const siblingsByBooking: Record<number, typeof allSiblings> = {};
  for (const s of allSiblings) {
    if (!siblingsByBooking[s.bookingId]) siblingsByBooking[s.bookingId] = [];
    siblingsByBooking[s.bookingId].push(s);
  }

  const bookings = rows.map((b) => ({
    id: b.id,
    referenceNumber: b.referenceNumber,
    childName: b.childName,
    childAddress: b.childAddress,
    childPostalCode: b.childPostalCode ?? "",
    childCity: b.childCity ?? "",
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
    siblingCount: (siblingsByBooking[b.id] ?? []).length,
    priceCents: b.priceCents,
    distanceKm: b.distanceKm ?? null,
    durationMinutes: b.durationMinutes ?? null,
    siblings: (siblingsByBooking[b.id] ?? []).map((s) => ({
      id: s.id,
      childName: s.childName,
      studentNumber: s.studentNumber,
      gradeYear: s.gradeYear,
      outboundRoute: s.outboundRoute,
      returnRoute: s.returnRoute,
      priceCents: s.priceCents,
    })),
  }));

  res.json({ bookings, total: Number(total), page, limit, totalPriceCents: Number(totalPriceCents ?? 0) + siblingTotalCents });
});

router.post("/admin/bookings/calculate-routes", requireAuth, async (req, res) => {
  // Fetch all bookings without distance/duration data
  const bookings = await db
    .select({
      id: bookingsTable.id,
      childName: bookingsTable.childName,
      childAddress: bookingsTable.childAddress,
      childPostalCode: bookingsTable.childPostalCode,
      childCity: bookingsTable.childCity,
      distanceKm: bookingsTable.distanceKm,
      durationMinutes: bookingsTable.durationMinutes,
    })
    .from(bookingsTable)
    .orderBy(bookingsTable.id);

  const pending = bookings.filter((b) => b.distanceKm == null || b.durationMinutes == null);

  let processed = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const b of pending) {
    try {
      const result = await calcRouteToSchool(b.childAddress, b.childPostalCode ?? "", b.childCity ?? "");
      if (result) {
        await db
          .update(bookingsTable)
          .set({ distanceKm: result.distanceKm, durationMinutes: result.durationMinutes })
          .where(eq(bookingsTable.id, b.id));
        processed++;
      } else {
        errors.push(`${b.childName}: Adresse konnte nicht geocodiert werden`);
        failed++;
      }
    } catch (err: any) {
      errors.push(`${b.childName}: ${err.message ?? "Fehler"}`);
      failed++;
    }
    // Nominatim rate limit: max 1 req/sec
    await sleep(1100);
  }

  res.json({
    processed,
    failed,
    skipped: bookings.length - pending.length,
    errors,
  });
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
    childPostalCode: booking.childPostalCode ?? "",
    childCity: booking.childCity ?? "",
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
    priceCents: booking.priceCents,
    distanceKm: booking.distanceKm ?? null,
    durationMinutes: booking.durationMinutes ?? null,
    siblings: siblings.map((s) => ({
      id: s.id,
      childName: s.childName,
      studentNumber: s.studentNumber,
      gradeYear: s.gradeYear,
      outboundRoute: s.outboundRoute,
      returnRoute: s.returnRoute,
      priceCents: s.priceCents,
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

  // Fetch current booking to detect parent name / price-affecting field changes
  const [current] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, id));
  if (!current) {
    res.status(404).json({ error: "Buchung nicht gefunden" });
    return;
  }

  const d = parsed.data;
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (d.status !== undefined) updates.status = d.status;
  if (d.adminNotes !== undefined) updates.adminNotes = d.adminNotes;
  if (d.childName !== undefined) updates.childName = d.childName;
  if (d.studentNumber !== undefined) updates.studentNumber = d.studentNumber ?? null;
  if (d.gradeYear !== undefined) updates.gradeYear = d.gradeYear;
  if (d.childAddress !== undefined) updates.childAddress = d.childAddress;
  if (d.childPostalCode !== undefined) updates.childPostalCode = d.childPostalCode;
  if (d.childCity !== undefined) updates.childCity = d.childCity;
  if (d.parentName !== undefined) updates.parentName = d.parentName;
  if (d.parentEmail !== undefined) updates.parentEmail = d.parentEmail;
  if (d.parentPhone !== undefined) updates.parentPhone = d.parentPhone ?? null;
  if (d.tariffZone !== undefined) updates.tariffZone = d.tariffZone;
  if (d.bookingType !== undefined) updates.bookingType = d.bookingType;
  if (d.outboundRoute !== undefined) updates.outboundRoute = d.outboundRoute;
  if (d.returnRoute !== undefined) updates.returnRoute = d.returnRoute;

  // Recalculate own price if any price-affecting field changes
  const priceFieldsChanged =
    d.tariffZone !== undefined || d.bookingType !== undefined ||
    d.outboundRoute !== undefined || d.returnRoute !== undefined;
  if (priceFieldsChanged) {
    const zone = (d.tariffZone ?? current.tariffZone) as string;
    const bType = (d.bookingType ?? current.bookingType) as string;
    const out = (d.outboundRoute ?? current.outboundRoute) as string;
    const ret = (d.returnRoute ?? current.returnRoute) as string;
    const { calcBookingPrice } = await import("../pricing.js");
    updates.priceCents = calcBookingPrice(zone as any, bType as any, out as any, ret as any);
  }

  const [updated] = await db
    .update(bookingsTable)
    .set(updates)
    .where(eq(bookingsTable.id, id))
    .returning();

  // Recalculate family prices after update
  const newParentName = (d.parentName ?? current.parentName) as string;
  await recalcFamilyPrices(newParentName);
  if (d.parentName !== undefined && d.parentName !== current.parentName) {
    await recalcFamilyPrices(current.parentName);
  }

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
    childPostalCode: updated.childPostalCode ?? "",
    childCity: updated.childCity ?? "",
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

// ── Temporary seed endpoint (remove after data migration) ────────────────────

router.post("/admin/seed-bookings", async (req, res) => {
  const secret = req.headers["x-seed-secret"];
  const expectedSecret = process.env.ADMIN_PASSWORD ?? "louisenlund2026";
  if (secret !== expectedSecret) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const rows: any[] = req.body;
  if (!Array.isArray(rows)) {
    res.status(400).json({ error: "Expected array" });
    return;
  }
  let inserted = 0;
  for (const r of rows) {
    await db.insert(bookingsTable).values({
      id: Number(r.id),
      referenceNumber: r.reference_number,
      childName: r.child_name,
      childAddress: r.child_address,
      studentNumber: r.student_number || null,
      gradeYear: r.grade_year,
      parentName: r.parent_name,
      parentEmail: r.parent_email,
      parentPhone: r.parent_phone,
      tariffZone: r.tariff_zone as any,
      bookingType: r.booking_type as any,
      outboundRoute: r.outbound_route as any,
      returnRoute: r.return_route as any,
      confirmationAccepted: r.confirmation_accepted === "t" || r.confirmation_accepted === true,
      signatureName: r.signature_name || null,
      gdprConsent: r.gdpr_consent === "t" || r.gdpr_consent === true,
      status: (r.status || "received") as any,
      adminNotes: r.admin_notes || null,
      priceCents: r.price_cents ? Number(r.price_cents) : null,
      createdAt: new Date(r.created_at),
      updatedAt: new Date(r.updated_at),
    }).onConflictDoNothing();
    inserted++;
  }
  // Sync sequence
  await db.execute(sql`SELECT setval('bookings_id_seq', (SELECT MAX(id) FROM bookings))`);
  res.json({ inserted });
});

// ── SMTP Config ─────────────────────────────────────────────────────────────

async function getOrCreateSmtpRow() {
  const [row] = await db.select().from(smtpConfigTable).where(eq(smtpConfigTable.id, 1));
  if (row) return row;
  const [created] = await db.insert(smtpConfigTable).values({ id: 1 }).returning();
  return created;
}

router.get("/admin/smtp-config", requireAuth, async (_req, res) => {
  const row = await getOrCreateSmtpRow();
  res.json({
    host: row.host,
    port: row.port,
    user: row.user,
    fromAddress: row.fromAddress,
    secure: row.secure,
    configured: !!(row.host && row.user && row.pass),
  });
});

router.put("/admin/smtp-config", requireAuth, async (req, res) => {
  const { host, port, user, pass, fromAddress, secure } = req.body;
  const current = await getOrCreateSmtpRow();
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (host !== undefined) updates.host = String(host);
  if (port !== undefined) updates.port = Number(port);
  if (user !== undefined) updates.user = String(user);
  if (pass !== undefined && String(pass).length > 0) updates.pass = String(pass);
  if (fromAddress !== undefined) updates.fromAddress = String(fromAddress);
  if (secure !== undefined) updates.secure = Boolean(secure);

  const [updated] = await db.update(smtpConfigTable).set(updates).where(eq(smtpConfigTable.id, 1)).returning();
  const row = updated ?? current;
  res.json({
    host: row.host,
    port: row.port,
    user: row.user,
    fromAddress: row.fromAddress,
    secure: row.secure,
    configured: !!(row.host && row.user && row.pass),
  });
});

router.post("/admin/smtp-config/test", requireAuth, async (req, res) => {
  const { to } = req.body;
  if (!to) {
    res.status(400).json({ success: false, error: "Empfängeradresse fehlt" });
    return;
  }
  try {
    const row = await getOrCreateSmtpRow();
    if (!row.host || !row.user || !row.pass) {
      res.json({ success: false, error: "SMTP ist nicht vollständig konfiguriert (Host, Benutzer und Passwort erforderlich)." });
      return;
    }
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.default.createTransport({
      host: row.host,
      port: row.port,
      secure: row.secure,
      auth: { user: row.user, pass: row.pass },
    });
    await transporter.sendMail({
      from: row.fromAddress,
      to: String(to),
      subject: "Test-E-Mail – Regionalshuttle Louisenlund",
      text: "Dies ist eine Test-E-Mail vom Buchungssystem Regionalshuttle Louisenlund. Die SMTP-Konfiguration ist korrekt.",
    });
    res.json({ success: true, error: null });
  } catch (err: any) {
    res.json({ success: false, error: err.message ?? "Unbekannter Fehler" });
  }
});

export default router;
