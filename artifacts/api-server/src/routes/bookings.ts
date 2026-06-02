import { Router } from "express";
import { db } from "@workspace/db";
import { bookingsTable, siblingsTable } from "@workspace/db";
import { CreateBookingBody } from "@workspace/api-zod";
import { eq } from "drizzle-orm";
import { sendBookingNotification, sendParentConfirmation } from "../services/email.js";
import { calcBookingPrice, calcSiblingPrice, gradeRank } from "../pricing.js";
import { recalcFamilyPrices } from "../services/family.js";

const router = Router();

function generateReferenceNumber(): string {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 90000) + 10000;
  return `LL-${year}-${random}`;
}

router.post("/bookings", async (req, res) => {
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

  const priceCents = mainIsFullPayer
    ? calcBookingPrice(data.tariffZone, data.bookingType, data.outboundRoute, data.returnRoute)
    : calcSiblingPrice(data.tariffZone, data.bookingType, data.outboundRoute, data.returnRoute);

  const [booking] = await db
    .insert(bookingsTable)
    .values({
      ...bookingFields,
      referenceNumber,
      gdprConsent: gdprConsent ?? false,
      priceCents,
      status: "received",
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
        ? calcBookingPrice(data.tariffZone, data.bookingType, sibling.outboundRoute, sibling.returnRoute)
        : calcSiblingPrice(data.tariffZone, data.bookingType, sibling.outboundRoute, sibling.returnRoute);
      await db.insert(siblingsTable).values({
        bookingId: booking.id,
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
