type TariffZone = "zone1" | "zone2" | "zone3";
type BookingType = "full_year" | "first_half";
type RouteOption = "zone1" | "zone2" | "zone3" | "none";

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

export function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
