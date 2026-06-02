import { db } from "@workspace/db";
import { bookingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { calcBookingPriceFromConfig, gradeRank } from "../pricing.js";
import { getPricingConfig } from "./pricing-cache.js";

const SIBLING_DISCOUNT = 0.8;

/**
 * Recalculates prices for all bookings with the same parentName.
 * The child with the highest grade rank is the Vollzahler (full price).
 * Tie-breaker: the booking with the lowest id wins.
 * All other bookings pay 80% of their own full price (20% sibling discount).
 * Also updates adminNotes to reflect sibling status.
 */
export async function recalcFamilyPrices(parentName: string): Promise<void> {
  const bookings = await db
    .select()
    .from(bookingsTable)
    .where(eq(bookingsTable.parentName, parentName))
    .orderBy(bookingsTable.id);

  if (bookings.length <= 1) return;

  const pricingConfig = await getPricingConfig();

  // Sort descending by grade rank; tie-breaker: oldest booking (lowest id) first
  const sorted = [...bookings].sort((a, b) => {
    const diff = gradeRank(b.gradeYear) - gradeRank(a.gradeYear);
    return diff !== 0 ? diff : a.id - b.id;
  });

  const vollzahler = sorted[0];
  const siblingCount = bookings.length - 1;

  for (let i = 0; i < sorted.length; i++) {
    const b = sorted[i];
    const fullPrice = calcBookingPriceFromConfig(
      pricingConfig,
      b.tariffZone,
      b.bookingType,
      b.outboundRoute,
      b.returnRoute,
    );
    const isFullPayer = i === 0;
    const priceCents = isFullPayer ? fullPrice : Math.round(fullPrice * SIBLING_DISCOUNT);
    const adminNotes = isFullPayer
      ? `Vollzahler (${siblingCount} Geschwisterkind${siblingCount > 1 ? "er" : ""}, Klasse ${b.gradeYear})`
      : `Geschwisterkind – 20 % Rabatt (${vollzahler.childName}, Klasse ${vollzahler.gradeYear})`;

    await db
      .update(bookingsTable)
      .set({ priceCents, adminNotes })
      .where(eq(bookingsTable.id, b.id));
  }
}
