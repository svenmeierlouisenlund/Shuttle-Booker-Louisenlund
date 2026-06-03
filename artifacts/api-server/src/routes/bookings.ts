import { Router } from "express";
import { db } from "@workspace/db";
import { bookingsTable, siblingsTable, busesTable, busAssignmentsTable, siblingBusAssignmentsTable } from "@workspace/db";
import { CreateBookingBody } from "@workspace/api-zod";
import { eq, sql } from "drizzle-orm";
import { sendBookingNotification, sendParentConfirmation } from "../services/email.js";
import { calcBookingPriceFromConfig, calcSiblingPriceFromConfig, gradeRank } from "../pricing.js";
import { getPricingConfig } from "../services/pricing-cache.js";
import { recalcFamilyPrices } from "../services/family.js";

const router = Router();

function generateReferenceNumber(): string {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 90000) + 10000;
  return `LL-${year}-${random}`;
}

router.post("/bookings", async (req, res) => {
  // Cloudflare Turnstile verification
  const cfToken = (req.body as Record<string, unknown>)?.cfTurnstileToken;
  const tsSecret = process.env.TURNSTILE_SECRET_KEY;
  if (tsSecret) {
    if (!cfToken) {
      res.status(400).json({ error: "Sicherheitsüberprüfung erforderlich. Bitte aktualisieren Sie die Seite." });
      return;
    }
    const fd = new FormData();
    fd.append("secret", tsSecret);
    fd.append("response", String(cfToken));
    try {
      const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: fd });
      const outcome = await r.json() as { success: boolean };
      if (!outcome.success) {
        res.status(400).json({ error: "Sicherheitsüberprüfung fehlgeschlagen. Bitte versuchen Sie es erneut." });
        return;
      }
    } catch (e) {
      req.log.warn({ err: e }, "Turnstile verification network error — allowing request");
    }
  }

  const parsed = CreateBookingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Ungültige Eingabe: " + parsed.error.message });
    return;
  }

  const data = parsed.data;

  if (data.outboundRoute === "none" && data.returnRoute === "none") {
    res.status(400).json({ error: "Es muss mindestens eine Hin- oder Rückfahrt gewählt werden." });
    return;
  }

  if (!data.confirmationAccepted) {
    res.status(400).json({ error: "Die verbindliche Buchungsbestätigung muss akzeptiert werden." });
    return;
  }

  let referenceNumber = generateReferenceNumber();
  let attempts = 0;
  while (attempts < 5) {
    const existing = await db
      .select({ id: bookingsTable.id })
      .from(bookingsTable)
      .where(eq(bookingsTable.referenceNumber, referenceNumber))
      .limit(1);
    if (existing.length === 0) break;
    referenceNumber = generateReferenceNumber();
    attempts++;
  }

  const { siblings, gdprConsent, ...bookingFields } = data;

  // Determine Vollzahler: the child with the highest grade rank pays full price.
  // Tie-breaker: main child wins (rank >=, not strictly >).
  const validSiblings = (siblings ?? []).filter(
    s => s.outboundRoute !== "none" || s.returnRoute !== "none",
  );
  const allGrades = [data.gradeYear, ...validSiblings.map(s => s.gradeYear)];
  const maxRank = Math.max(...allGrades.map(gradeRank));
  const mainIsFullPayer = gradeRank(data.gradeYear) >= maxRank;

  const pricingConfig = await getPricingConfig();

  const priceCents = mainIsFullPayer
    ? calcBookingPriceFromConfig(pricingConfig, data.tariffZone, data.bookingType, data.outboundRoute, data.returnRoute)
    : calcSiblingPriceFromConfig(pricingConfig, data.tariffZone, data.bookingType, data.outboundRoute, data.returnRoute);

  // Check if all buses are full → waitlist (count both booking + sibling assignments)
  const capacityResult = await db.select({ totalCapacity: sql<number>`COALESCE(SUM(capacity), 0)` }).from(busesTable);
  const assignedBookings = await db.select({ c: sql<number>`COUNT(*)` }).from(busAssignmentsTable);
  const assignedSiblings = await db.select({ c: sql<number>`COUNT(*)` }).from(siblingBusAssignmentsTable);
  const totalCapacity = Number(capacityResult[0]?.totalCapacity ?? 0);
  const totalAssigned = Number(assignedBookings[0]?.c ?? 0) + Number(assignedSiblings[0]?.c ?? 0);
  const isFull = totalCapacity > 0 && totalAssigned >= totalCapacity;
  const bookingStatus = isFull ? "waitlisted" : "received";

  const [booking] = await db
    .insert(bookingsTable)
    .values({
      ...bookingFields,
      referenceNumber,
      gdprConsent: gdprConsent ?? false,
      priceCents,
      status: bookingStatus,
    })
    .returning();

  if (siblings && siblings.length > 0) {
    // Among siblings, the first one whose grade rank equals maxRank (and main is not full payer)
    // becomes the Vollzahler.
    let fullPayerSiblingFound = mainIsFullPayer;
    for (const sibling of siblings) {
      if (sibling.outboundRoute === "none" && sibling.returnRoute === "none") {
        continue;
      }
      const isFullPayer = !fullPayerSiblingFound && gradeRank(sibling.gradeYear) === maxRank;
      if (isFullPayer) fullPayerSiblingFound = true;
      const siblingPriceCents = isFullPayer
        ? calcBookingPriceFromConfig(pricingConfig, data.tariffZone, data.bookingType, sibling.outboundRoute, sibling.returnRoute)
        : calcSiblingPriceFromConfig(pricingConfig, data.tariffZone, data.bookingType, sibling.outboundRoute, sibling.returnRoute);
      let sibRef = generateReferenceNumber();
      while ((await db.select({ id: siblingsTable.id }).from(siblingsTable).where(eq(siblingsTable.referenceNumber, sibRef)).limit(1)).length > 0) {
        sibRef = generateReferenceNumber();
      }
      await db.insert(siblingsTable).values({
        bookingId: booking.id,
        referenceNumber: sibRef,
        ...sibling,
        priceCents: siblingPriceCents,
      });
    }
  }

  req.log.info({ bookingId: booking.id, referenceNumber }, "Booking created");

  // Recalculate family prices: if same parent already has bookings, apply sibling discount
  recalcFamilyPrices(data.parentName).catch(() => {});

  const insertedSiblings = siblings
    ? await db.select().from(siblingsTable).where(eq(siblingsTable.bookingId, booking.id))
    : [];
  sendBookingNotification(booking, insertedSiblings).catch(() => {});
  sendParentConfirmation(booking, insertedSiblings).catch(() => {});

  res.status(201).json({
    id: booking.id,
    referenceNumber: booking.referenceNumber,
    message: `Ihre Buchung wurde erfolgreich eingereicht. Referenznummer: ${booking.referenceNumber}`,
  });
});

export default router;
