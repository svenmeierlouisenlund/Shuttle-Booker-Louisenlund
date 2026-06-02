import { Router, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { bookingsTable, siblingsTable, notificationEmailsTable, smtpConfigTable, pricingConfigTable } from "@workspace/db";
import {
  ListAdminBookingsQueryParams,
  UpdateAdminBookingBody,
  AdminLoginBody,
  ExportBookingsQueryParams,
  AddNotificationEmailBody,
} from "@workspace/api-zod";
import { eq, and, count, sum, desc, sql, inArray, or } from "drizzle-orm";
import ExcelJS from "exceljs";
import multer from "multer";
import { calcBookingPriceFromConfig, calcSiblingPriceFromConfig, gradeRank } from "../pricing.js";
import { getPricingConfig, invalidatePricingConfig } from "../services/pricing-cache.js";
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

router.post("/admin/verify-password", requireAuth, (req, res) => {
  const parsed = AdminLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Ungültige Eingabe" });
    return;
  }
  if (parsed.data.password !== ADMIN_PASSWORD) {
    res.status(401).json({ error: "Falsches Passwort" });
    return;
  }
  res.json({ verified: true });
});

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

  const importPricingConfig = await getPricingConfig();

  let allRows: unknown[][];
  try {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(req.file.buffer as unknown as Parameters<typeof wb.xlsx.load>[0]);
    const ws = wb.worksheets[0];
    if (!ws) throw new Error("No worksheet found");
    allRows = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      const values = (row.values as unknown[]).slice(1);
      allRows.push(values);
    });
  } catch {
    res.status(400).json({ error: "Ungültige Excel-Datei" });
    return;
  }

  // ── Format detection ────────────────────────────────────────────────────────
  // New format: Ref | Typ | Name Kind | Straße | PLZ | Wohnort | [Schülernummer] | Jahrgang | ...
  // Old format (10 cols): Name Kind | Schülernummer | Jahrgang | Straße | PLZ | Ort | Elternteil | E-Mail | Telefon | Tarifzone
  const headerRow = allRows[0] as unknown[];
  const colCount = headerRow ? headerRow.length : 0;
  const isNewFormat = colCount >= 15 || cleanStr(headerRow?.[1]).toLowerCase() === "typ";

  // Build dynamic column map from header row (name → index).
  // Normalise: lowercase, collapse spaces, strip umlauts for matching.
  const normalizeHeader = (v: unknown) =>
    cleanStr(v).toLowerCase()
      .replace(/ü/g, "u").replace(/ö/g, "o").replace(/ä/g, "a").replace(/ß/g, "ss")
      .replace(/\s+/g, " ").trim();
  const colMap = new Map<string, number>();
  if (headerRow) {
    for (let i = 0; i < headerRow.length; i++) {
      colMap.set(normalizeHeader(headerRow[i]), i);
    }
  }
  // Helper: read first matching column name from data row (names are normalised before lookup)
  function colVal(row: unknown[], ...names: string[]): unknown {
    for (const name of names) {
      const idx = colMap.get(normalizeHeader(name));
      if (idx !== undefined) return (row as any)[idx] ?? "";
    }
    return "";
  }

  const rows = allRows.slice(1) as unknown[][];

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];
  const importedParentNames = new Set<string>();

  // ── Helper: parse a row's fields (new format via colMap, old format positional) ──
  function parseRow(row: unknown[]) {
    let typ: string;
    let refNum: string;
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
    let outboundRoute: string;
    let returnRoute: string;
    let status: string;
    let adminNotes: string;

    if (isNewFormat) {
      typ = cleanStr(colVal(row, "typ")).toLowerCase();
      refNum = cleanStr(colVal(row, "referenznummer"));
      childName = cleanStr(colVal(row, "name kind"));
      childAddress = cleanStr(colVal(row, "straße", "strasse"));
      childPostalCode = cleanStr(colVal(row, "plz"));
      childCity = cleanStr(colVal(row, "wohnort"));
      studentNumber = cleanStr(colVal(row, "schülernummer", "schulernummer")) || null;
      gradeYear = mapGrade(colVal(row, "jahrgang"));
      parentName = cleanStr(colVal(row, "name elternteil")) || "Unbekannt";
      parentEmail = cleanStr(colVal(row, "e-mail", "email"));
      parentPhone = cleanStr(colVal(row, "telefon"));
      tariffZone = ZONE_MAP[cleanStr(colVal(row, "tarifzone"))] ?? "zone1";
      bookingType = (BOOKING_TYPE_MAP[cleanStr(colVal(row, "buchungsart"))] ?? "full_year") as "full_year" | "first_half";
      outboundRoute = (ROUTE_MAP[cleanStr(colVal(row, "hinfahrt"))] ?? tariffZone) as string;
      returnRoute = (ROUTE_MAP[cleanStr(colVal(row, "rückfahrt", "ruckfahrt"))] ?? tariffZone) as string;
      status = (STATUS_IMPORT_MAP[cleanStr(colVal(row, "status"))] ?? "confirmed") as string;
      adminNotes = cleanStr(colVal(row, "notizen")) || "Importiert";
    } else {
      refNum = "";
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
      outboundRoute = tariffZone;
      returnRoute = tariffZone;
      status = "confirmed";
      adminNotes = "Importiert aus Vorjahresdaten";
      typ = "hauptkind"; // determined later by seenParentEmails
    }
    return { typ, refNum, childName, childAddress, childPostalCode, childCity, studentNumber, gradeYear, parentName, parentEmail, parentPhone, tariffZone, bookingType, outboundRoute, returnRoute, status, adminNotes };
  }

  // ── New format: two-pass (Hauptkind first, then Geschwister) ─────────────
  // Old format: single-pass with parentEmail-based sibling detection
  // Referenznummer → DB booking id (populated during pass 1)
  const refToBookingId = new Map<string, number>();
  // Old format only: email → booking id
  const seenParentEmails = new Map<string, number>();

  // ── Pass 1: all Hauptkind rows (+ old-format rows) ──────────────────────
  for (const row of rows) {
    // In new format, skip Geschwister now — they are processed in pass 2
    if (isNewFormat) {
      const quickTyp = cleanStr(colVal(row, "typ")).toLowerCase();
      if (quickTyp === "geschwister") continue;
    }

    try {
      const f = parseRow(row);
      if (!f.childName) continue;

      // Old format: detect siblings via parentEmail
      if (!isNewFormat && seenParentEmails.has(f.parentEmail)) {
        // This is a sibling in old format — handle inline (no deferred pass needed)
        const mainId = seenParentEmails.get(f.parentEmail)!;
        const existingSib = await db.select({ id: siblingsTable.id }).from(siblingsTable)
          .where(and(eq(siblingsTable.bookingId, mainId), eq(siblingsTable.childName, f.childName))).limit(1);
        if (existingSib.length > 0) { skipped++; continue; }
        const sibPriceCents = calcBookingPriceFromConfig(importPricingConfig, f.tariffZone as any, f.bookingType, f.outboundRoute as any, f.returnRoute as any);
        await db.insert(siblingsTable).values({
          bookingId: mainId, childName: f.childName, studentNumber: f.studentNumber,
          gradeYear: f.gradeYear, outboundRoute: f.outboundRoute as any, returnRoute: f.returnRoute as any,
          priceCents: Math.round(sibPriceCents * 0.8),
        });
        importedParentNames.add(f.parentName);
        imported++;
        continue;
      }

      // Hauptkind: check for duplicate
      const existing = await db.select({ id: bookingsTable.id }).from(bookingsTable)
        .where(and(eq(bookingsTable.childName, f.childName), eq(bookingsTable.parentEmail, f.parentEmail))).limit(1);

      if (existing.length > 0) {
        if (isNewFormat) refToBookingId.set(f.refNum, existing[0].id);
        else seenParentEmails.set(f.parentEmail, existing[0].id);
        skipped++;
        continue;
      }

      let newRef = isNewFormat ? f.refNum : genRef();
      // Ensure ref uniqueness when generating a new one
      if (!isNewFormat || (await db.select({ id: bookingsTable.id }).from(bookingsTable).where(eq(bookingsTable.referenceNumber, newRef)).limit(1)).length > 0) {
        newRef = genRef();
        while ((await db.select({ id: bookingsTable.id }).from(bookingsTable).where(eq(bookingsTable.referenceNumber, newRef)).limit(1)).length > 0) {
          newRef = genRef();
        }
      }

      const priceCents = calcBookingPriceFromConfig(importPricingConfig, f.tariffZone as any, f.bookingType, f.outboundRoute as any, f.returnRoute as any);
      const [inserted] = await db.insert(bookingsTable).values({
        referenceNumber: newRef, childName: f.childName, childAddress: f.childAddress,
        childPostalCode: f.childPostalCode, childCity: f.childCity, studentNumber: f.studentNumber,
        gradeYear: f.gradeYear, parentName: f.parentName, parentEmail: f.parentEmail,
        parentPhone: f.parentPhone, tariffZone: f.tariffZone as any, bookingType: f.bookingType,
        outboundRoute: f.outboundRoute as any, returnRoute: f.returnRoute as any,
        signatureName: f.parentName, status: f.status as any, priceCents, adminNotes: f.adminNotes,
      }).returning({ id: bookingsTable.id });

      if (isNewFormat) refToBookingId.set(f.refNum, inserted.id);
      else seenParentEmails.set(f.parentEmail, inserted.id);
      importedParentNames.add(f.parentName);
      imported++;
    } catch (err: any) {
      const childName = cleanStr((row as any)[isNewFormat ? 2 : 0]);
      errors.push(`${childName || "Zeile"}: ${err.message ?? "Fehler"}`);
    }
  }

  // ── Pass 2 (new format only): all Geschwister rows ───────────────────────
  if (isNewFormat) {
    for (const row of rows) {
      const quickTyp = cleanStr(colVal(row, "typ")).toLowerCase();
      if (quickTyp !== "geschwister") continue;

      try {
        const f = parseRow(row);
        if (!f.childName) continue;

        // Look up parent booking by reference number
        let mainId = refToBookingId.get(f.refNum) ?? null;
        if (mainId === null && f.refNum) {
          // Fallback: look up in DB (booking may have existed before this import run)
          const found = await db.select({ id: bookingsTable.id }).from(bookingsTable)
            .where(eq(bookingsTable.referenceNumber, f.refNum)).limit(1);
          if (found.length > 0) mainId = found[0].id;
        }

        if (mainId === null) {
          errors.push(`${f.childName}: Geschwister ohne zugehörige Hauptbuchung (Ref: ${f.refNum || "unbekannt"})`);
          skipped++;
          continue;
        }

        const existingSib = await db.select({ id: siblingsTable.id }).from(siblingsTable)
          .where(and(eq(siblingsTable.bookingId, mainId), eq(siblingsTable.childName, f.childName))).limit(1);
        if (existingSib.length > 0) { skipped++; continue; }

        const sibPriceCents = calcBookingPriceFromConfig(importPricingConfig, f.tariffZone as any, f.bookingType, f.outboundRoute as any, f.returnRoute as any);
        await db.insert(siblingsTable).values({
          bookingId: mainId, childName: f.childName, studentNumber: f.studentNumber,
          gradeYear: f.gradeYear, outboundRoute: f.outboundRoute as any, returnRoute: f.returnRoute as any,
          priceCents: Math.round(sibPriceCents * 0.8),
        });
        importedParentNames.add(f.parentName);
        imported++;
      } catch (err: any) {
        const childName = cleanStr((row as any)[2]);
        errors.push(`${childName || "Zeile"}: ${err.message ?? "Fehler"}`);
      }
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
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Buchungen");

    const colWidths = [18, 12, 28, 35, 8, 18, 14, 12, 28, 30, 16, 14, 32, 14, 14, 12, 18, 40, 16];
    ws.columns = colWidths.map((width) => ({ width }));

    const headerRow = ws.addRow(headers);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF004289" } };
    });

    for (const row of dataRows) {
      ws.addRow(row);
    }

    const buf = await wb.xlsx.writeBuffer();

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
    d.outboundRoute !== undefined || d.returnRoute !== undefined ||
    d.gradeYear !== undefined;
  if (priceFieldsChanged) {
    const zone = (d.tariffZone ?? current.tariffZone) as any;
    const bType = (d.bookingType ?? current.bookingType) as any;
    const out = (d.outboundRoute ?? current.outboundRoute) as any;
    const ret = (d.returnRoute ?? current.returnRoute) as any;
    const mainGrade = d.gradeYear ?? current.gradeYear;
    const patchConfig = await getPricingConfig();

    // Fetch siblings to determine full-payer across main + siblings
    const currentSiblings = await db.select().from(siblingsTable).where(eq(siblingsTable.bookingId, id));

    const allGrades = [mainGrade, ...currentSiblings.map((s) => s.gradeYear)];
    const maxRank = Math.max(...allGrades.map((g) => gradeRank(g)));
    let fullPayerFound = false;

    const mainIsFullPayer = gradeRank(mainGrade) === maxRank && !fullPayerFound;
    if (mainIsFullPayer) fullPayerFound = true;

    const mainFullPrice = calcBookingPriceFromConfig(patchConfig, zone, bType, out, ret);
    updates.priceCents = mainIsFullPayer ? mainFullPrice : Math.round(mainFullPrice * 0.8);

    // Recalculate each sibling's price
    for (const sib of currentSiblings) {
      const sibIsFullPayer = gradeRank(sib.gradeYear) === maxRank && !fullPayerFound;
      if (sibIsFullPayer) fullPayerFound = true;
      const sibFullPrice = calcBookingPriceFromConfig(patchConfig, zone, bType, sib.outboundRoute as any, sib.returnRoute as any);
      const sibPrice = sibIsFullPayer ? sibFullPrice : Math.round(sibFullPrice * 0.8);
      await db.update(siblingsTable).set({ priceCents: sibPrice }).where(eq(siblingsTable.id, sib.id));
    }
  }

  const [updated] = await db
    .update(bookingsTable)
    .set(updates)
    .where(eq(bookingsTable.id, id))
    .returning();

  // Recalculate family prices after update (separate bookings with same parentName)
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
    priceCents: updated.priceCents,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
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

router.get("/admin/pricing", requireAuth, async (req, res) => {
  const c = await getPricingConfig();
  res.json({
    fullYear: {
      both:   { zone1: c.fullYearBothZone1,   zone2: c.fullYearBothZone2,   zone3: c.fullYearBothZone3 },
      oneWay: { zone1: c.fullYearOneWayZone1, zone2: c.fullYearOneWayZone2, zone3: c.fullYearOneWayZone3 },
    },
    firstHalf: {
      both:   { zone1: c.firstHalfBothZone1,   zone2: c.firstHalfBothZone2,   zone3: c.firstHalfBothZone3 },
      oneWay: { zone1: c.firstHalfOneWayZone1, zone2: c.firstHalfOneWayZone2, zone3: c.firstHalfOneWayZone3 },
    },
    updatedAt: c.updatedAt.toISOString(),
  });
});

router.put("/admin/pricing", requireAuth, async (req, res) => {
  const { fullYear, firstHalf } = req.body ?? {};
  const parse = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
  };
  const updates = {
    fullYearBothZone1:    parse(fullYear?.both?.zone1),
    fullYearBothZone2:    parse(fullYear?.both?.zone2),
    fullYearBothZone3:    parse(fullYear?.both?.zone3),
    fullYearOneWayZone1:  parse(fullYear?.oneWay?.zone1),
    fullYearOneWayZone2:  parse(fullYear?.oneWay?.zone2),
    fullYearOneWayZone3:  parse(fullYear?.oneWay?.zone3),
    firstHalfBothZone1:   parse(firstHalf?.both?.zone1),
    firstHalfBothZone2:   parse(firstHalf?.both?.zone2),
    firstHalfBothZone3:   parse(firstHalf?.both?.zone3),
    firstHalfOneWayZone1: parse(firstHalf?.oneWay?.zone1),
    firstHalfOneWayZone2: parse(firstHalf?.oneWay?.zone2),
    firstHalfOneWayZone3: parse(firstHalf?.oneWay?.zone3),
    updatedAt: new Date(),
  };
  const invalid = Object.entries(updates).find(([k, v]) => k !== "updatedAt" && v === null);
  if (invalid) {
    res.status(400).json({ error: `Ungültiger Wert für ${invalid[0]}` });
    return;
  }
  const safeUpdates = updates as Record<string, number | Date>;
  const [row] = await db
    .insert(pricingConfigTable)
    .values({ id: 1, ...safeUpdates })
    .onConflictDoUpdate({ target: pricingConfigTable.id, set: safeUpdates })
    .returning();
  invalidatePricingConfig();
  res.json({
    fullYear: {
      both:   { zone1: row.fullYearBothZone1,   zone2: row.fullYearBothZone2,   zone3: row.fullYearBothZone3 },
      oneWay: { zone1: row.fullYearOneWayZone1, zone2: row.fullYearOneWayZone2, zone3: row.fullYearOneWayZone3 },
    },
    firstHalf: {
      both:   { zone1: row.firstHalfBothZone1,   zone2: row.firstHalfBothZone2,   zone3: row.firstHalfBothZone3 },
      oneWay: { zone1: row.firstHalfOneWayZone1, zone2: row.firstHalfOneWayZone2, zone3: row.firstHalfOneWayZone3 },
    },
    updatedAt: row.updatedAt.toISOString(),
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
      requireTLS: !row.secure,
      auth: { user: row.user, pass: row.pass },
      tls: { rejectUnauthorized: false },
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
