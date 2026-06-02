// Routing service using Nominatim (geocoding) + OSRM (routing)
// Both are free, open-source, require no API key.
// Nominatim policy: max 1 req/sec, User-Agent header required.

const NOMINATIM = "https://nominatim.openstreetmap.org";
const OSRM      = "https://router.project-osrm.org";
const UA        = "LouisenlundShuttle/1.0 (shuttle@louisenlund.de)";

// School destination — Louisenlund 9, 24357 Güby (Stiftung Louisenlund)
const SCHOOL_LAT = 54.5186;
const SCHOOL_LON =  9.7357;

async function geocode(address: string): Promise<{ lat: number; lon: number } | null> {
  const url = `${NOMINATIM}/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=de`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return null;
  const data = await res.json() as Array<{ lat: string; lon: string }>;
  if (!data.length) return null;
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
}

async function osrmRoute(
  fromLat: number, fromLon: number,
  toLat: number,   toLon: number,
): Promise<{ distanceKm: number; durationMinutes: number } | null> {
  const url = `${OSRM}/route/v1/driving/${fromLon},${fromLat};${toLon},${toLat}?overview=false`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return null;
  const data = await res.json() as { code: string; routes: Array<{ distance: number; duration: number }> };
  if (data.code !== "Ok" || !data.routes.length) return null;
  const route = data.routes[0];
  return {
    distanceKm:      Math.round(route.distance / 100) / 10,   // metres → km, 1 decimal
    durationMinutes: Math.round(route.duration / 60),          // seconds → minutes
  };
}

/** Calculate driving distance + duration from a full address to Louisenlund. */
export async function calcRouteToSchool(
  address: string,
  postalCode: string,
  city: string,
): Promise<{ distanceKm: number; durationMinutes: number } | null> {
  const fullAddress = [address, postalCode, city].filter(Boolean).join(", ");
  if (!fullAddress.trim()) return null;

  const coords = await geocode(fullAddress);
  if (!coords) return null;

  return osrmRoute(coords.lat, coords.lon, SCHOOL_LAT, SCHOOL_LON);
}

/** Sleep helper for rate-limiting (Nominatim: 1 req/s). */
export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
