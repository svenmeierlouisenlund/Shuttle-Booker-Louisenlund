import { Router } from "express";
import { db } from "@workspace/db";
import { bookingsTable, siblingsTable } from "@workspace/db";
import { CreateBookingBody } from "@workspace/api-zod";
import { eq } from "drizzle-orm";

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

  const [booking] = await db
    .insert(bookingsTable)
    .values({
      ...bookingFields,
      referenceNumber,
      gdprConsent: gdprConsent ?? false,
      status: "received",
    })
    .returning();

  if (siblings && siblings.length > 0) {
    for (const sibling of siblings) {
      if (sibling.outboundRoute === "none" && sibling.returnRoute === "none") {
        continue;
      }
      await db.insert(siblingsTable).values({
        bookingId: booking.id,
        ...sibling,
      });
    }
  }

  req.log.info({ bookingId: booking.id, referenceNumber }, "Booking created");

  res.status(201).json({
    id: booking.id,
    referenceNumber: booking.referenceNumber,
    message: `Ihre Buchung wurde erfolgreich eingereicht. Referenznummer: ${booking.referenceNumber}`,
  });
});

export default router;
