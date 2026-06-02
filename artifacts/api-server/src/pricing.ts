type TariffZone = "zone1" | "zone2" | "zone3";
type BookingType = "full_year" | "first_half";
type RouteOption = "zone1" | "zone2" | "zone3" | "none";

// Grade order: higher rank = higher school year = potential Vollzahler
const GRADE_RANKS: Record<string, number> = {
  "Jahrgang 1":  1,
  "Jahrgang 2":  2,
  "Jahrgang 3":  3,
  "Jahrgang 4":  4,
  "Jahrgang 5":  5,
  "Jahrgang 6":  6,
  "Jahrgang 7":  7,
  "Jahrgang 8":  8,
  "MYP3":        8,
  "Jahrgang 9":  9,
  "MYP4":        9,
  "Jahrgang 10": 10,
  "MYP5":        10,
  "E-Jahrgang":  11,
  "DP1":         11,
  "Q1-Jahrgang": 12,
  "DP2":         12,
  "Q2-Jahrgang": 13,
};

/** Returns a numeric rank for a grade string. Higher = older. Unknown grades → 0. */
export function gradeRank(grade: string): number {
  return GRADE_RANKS[grade] ?? 0;
}

// All prices in cents (€ × 100)
const PRICE_TABLE: Record<BookingType, Record<"both" | "one_way", Record<TariffZone, number>>> = {
  full_year: {
    both:    { zone1: 150000, zone2: 280000, zone3: 410000 },
    one_way: { zone1:  75000, zone2: 140000, zone3: 205000 },
  },
  first_half: {
    both:    { zone1:  85000, zone2: 155000, zone3: 230000 },
    one_way: { zone1:  42500, zone2:  77500, zone3: 115000 },
  },
};

const SIBLING_DISCOUNT = 0.8;

function routeType(outbound: RouteOption, ret: RouteOption): "both" | "one_way" {
  return outbound !== "none" && ret !== "none" ? "both" : "one_way";
}

export function calcBookingPrice(
  tariffZone: TariffZone,
  bookingType: BookingType,
  outboundRoute: RouteOption,
  returnRoute: RouteOption,
): number {
  const rt = routeType(outboundRoute, returnRoute);
  return PRICE_TABLE[bookingType][rt][tariffZone];
}

export function calcSiblingPrice(
  tariffZone: TariffZone,
  bookingType: BookingType,
  outboundRoute: RouteOption,
  returnRoute: RouteOption,
): number {
  const base = calcBookingPrice(tariffZone, bookingType, outboundRoute, returnRoute);
  return Math.round(base * SIBLING_DISCOUNT);
}

/** Subset of PricingConfig used for price calculation (no id/updatedAt) */
export interface PricingConfigValues {
  fullYearBothZone1: number;    fullYearBothZone2: number;    fullYearBothZone3: number;
  fullYearOneWayZone1: number;  fullYearOneWayZone2: number;  fullYearOneWayZone3: number;
  firstHalfBothZone1: number;   firstHalfBothZone2: number;   firstHalfBothZone3: number;
  firstHalfOneWayZone1: number; firstHalfOneWayZone2: number; firstHalfOneWayZone3: number;
}

export function calcBookingPriceFromConfig(
  config: PricingConfigValues,
  tariffZone: TariffZone,
  bookingType: BookingType,
  outboundRoute: RouteOption,
  returnRoute: RouteOption,
): number {
  const rt = routeType(outboundRoute, returnRoute);
  if (bookingType === "full_year") {
    if (rt === "both") {
      return tariffZone === "zone1" ? config.fullYearBothZone1
           : tariffZone === "zone2" ? config.fullYearBothZone2
           : config.fullYearBothZone3;
    }
    return tariffZone === "zone1" ? config.fullYearOneWayZone1
         : tariffZone === "zone2" ? config.fullYearOneWayZone2
         : config.fullYearOneWayZone3;
  }
  if (rt === "both") {
    return tariffZone === "zone1" ? config.firstHalfBothZone1
         : tariffZone === "zone2" ? config.firstHalfBothZone2
         : config.firstHalfBothZone3;
  }
  return tariffZone === "zone1" ? config.firstHalfOneWayZone1
       : tariffZone === "zone2" ? config.firstHalfOneWayZone2
       : config.firstHalfOneWayZone3;
}

export function calcSiblingPriceFromConfig(
  config: PricingConfigValues,
  tariffZone: TariffZone,
  bookingType: BookingType,
  outboundRoute: RouteOption,
  returnRoute: RouteOption,
): number {
  const base = calcBookingPriceFromConfig(config, tariffZone, bookingType, outboundRoute, returnRoute);
  return Math.round(base * SIBLING_DISCOUNT);
}

export function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
