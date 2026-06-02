import { db } from "@workspace/db";
import { bookingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { calcBookingPrice } from "../pricing.js";

const SIBLING_DISCOUNT = 0.8;

/**
 * Recalculates prices for all bookings with the same parentName.
 * The first booking (lowest id) pays full price.
 * All subsequent bookings pay 80% of their own full price (20% sibling discount).
 * Also updates adminNotes to reflect sibling status.
 */
export async function recalcFamilyPrices(parentName: string): Promise<void> {
  const bookings = await db
    .select()
    .from(bookingsTable)
    .where(eq(bookingsTable.parentName, parentName))
    .orderBy(bookingsTable.id);

  if (bookings.length <= 1) return;

  for (let i = 0; i < bookings.length; i++) {
    const b = bookings[i];
    const fullPrice = calcBookingPrice(
      b.tariffZone,
      b.bookingType,
      b.outboundRoute,
      b.returnRoute,
    );
    const isFirst = i === 0;
    const priceCents = isFirst ? fullPrice : Math.round(fullPrice * SIBLING_DISCOUNT);
    const siblingCount = bookings.length - 1;
    const adminNotes = isFirst
      ? `Vollzahler (${siblingCount} Geschwisterkind${siblingCount > 1 ? "er" : ""})`
      : `Geschwisterkind – 20 % Rabatt (${bookings[0].childName})`;

    await db
      .update(bookingsTable)
      .set({ priceCents, adminNotes })
      .where(eq(bookingsTable.id, b.id));
  }
}
