import { db, pricingConfigTable } from "@workspace/db";
import type { PricingConfig } from "@workspace/db";

let cached: PricingConfig | null = null;

export async function getPricingConfig(): Promise<PricingConfig> {
  if (cached) return cached;
  const rows = await db.select().from(pricingConfigTable).limit(1);
  if (rows.length === 0) {
    const [row] = await db.insert(pricingConfigTable).values({ id: 1 }).returning();
    cached = row;
  } else {
    cached = rows[0];
  }
  return cached!;
}

export function invalidatePricingConfig(): void {
  cached = null;
}
