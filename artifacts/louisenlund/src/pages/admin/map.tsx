import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { useListAdminBookings } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Loader2, AlertCircle } from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const CACHE_KEY = "ll_geocode_cache_v2";
const GEOCODE_DELAY_MS = 1100;

const statusMap: Record<string, string> = {
  received: "Eingegangen",
  reviewed: "Geprüft",
  confirmed: "Bestätigt",
  query_open: "Rückfrage offen",
};

const statusColorMap: Record<string, string> = {
  received: "#3b82f6",
  reviewed: "#f59e0b",
  confirmed: "#22c55e",
  query_open: "#ef4444",
};

const tariffZoneMap: Record<string, string> = {
  zone1: "Tarifzone 1",
  zone2: "Tarifzone 2",
  zone3: "Tarifzone 3",
};

function loadCache(): Record<string, [number, number] | null> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function saveCache(cache: Record<string, [number, number] | null>) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ignore storage errors
  }
}

async function geocodeAddress(address: string): Promise<[number, number] | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=de`;
    const res = await fetch(url, {
      headers: { "Accept-Language": "de", "User-Agent": "LouisenlundShuttle/1.0" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.length) return null;
    return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
  } catch {
    return null;
  }
}

function createColoredIcon(color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="25" height="41" viewBox="0 0 25 41">
    <path d="M12.5 0C5.6 0 0 5.6 0 12.5C0 21.9 12.5 41 12.5 41C12.5 41 25 21.9 25 12.5C25 5.6 19.4 0 12.5 0Z" fill="${color}" stroke="white" stroke-width="1.5"/>
    <circle cx="12.5" cy="12.5" r="5" fill="white"/>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: "",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [0, -38],
  });
}

type GeocodedBooking = {
  id: number;
  referenceNumber: string;
  childName: string;
  childAddress: string;
  gradeYear: string;
  parentName: string;
  tariffZone: string;
  status: string;
  coords: [number, number];
};

function FitBounds({ markers }: { markers: GeocodedBooking[] }) {
  const map = useMap();
  useEffect(() => {
    if (markers.length === 0) return;
    const bounds = L.latLngBounds(markers.map((m) => m.coords));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
  }, [markers.length]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export default function AdminMap() {
  const { data, isLoading } = useListAdminBookings({ limit: 1000 });

  const [markers, setMarkers] = useState<GeocodedBooking[]>([]);
  const [geocodedCount, setGeocodedCount] = useState(0);
  const [totalToGeocode, setTotalToGeocode] = useState(0);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [failedCount, setFailedCount] = useState(0);

  useEffect(() => {
    if (!data?.bookings) return;

    const bookings = data.bookings;
    const cache = loadCache();
    const initial: GeocodedBooking[] = [];
    const needsGeocode: typeof bookings = [];

    for (const b of bookings) {
      const cached = cache[b.childAddress];
      if (cached !== undefined) {
        if (cached) {
          initial.push({ id: b.id, referenceNumber: b.referenceNumber, childName: b.childName, childAddress: b.childAddress, gradeYear: b.gradeYear, parentName: b.parentName, tariffZone: b.tariffZone, status: b.status, coords: cached });
        }
      } else {
        needsGeocode.push(b);
      }
    }

    setMarkers(initial);

    if (needsGeocode.length === 0) return;

    setTotalToGeocode(needsGeocode.length);
    setGeocodedCount(0);
    setFailedCount(0);
    setIsGeocoding(true);

    let i = 0;
    let active = true;

    function processNext() {
      if (!active || i >= needsGeocode.length) {
        if (active) setIsGeocoding(false);
        return;
      }

      const booking = needsGeocode[i++];

      geocodeAddress(booking.childAddress).then((coords) => {
        cache[booking.childAddress] = coords;
        saveCache(cache);

        if (coords) {
          setMarkers((prev) => [
            ...prev,
            { id: booking.id, referenceNumber: booking.referenceNumber, childName: booking.childName, childAddress: booking.childAddress, gradeYear: booking.gradeYear, parentName: booking.parentName, tariffZone: booking.tariffZone, status: booking.status, coords },
          ]);
        } else {
          setFailedCount((n) => n + 1);
        }

        setGeocodedCount((n) => n + 1);
        setTimeout(processNext, GEOCODE_DELAY_MS);
      });
    }

    processNext();

    return () => { active = false; };
  }, [data]);

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="text-2xl font-serif font-semibold text-primary">Karte der Anmeldungen</h1>
          {!isLoading && data && (
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {data.total} Buchungen gesamt
              </span>
              {isGeocoding && (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Adressen werden geladen … {geocodedCount}/{totalToGeocode}
                </span>
              )}
              {!isGeocoding && failedCount > 0 && (
                <span className="flex items-center gap-1.5 text-amber-600">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {failedCount} Adresse{failedCount !== 1 ? "n" : ""} nicht gefunden
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-4 flex-wrap text-sm">
          {Object.entries(statusMap).map(([key, label]) => (
            <div key={key} className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full inline-block border border-white shadow-sm" style={{ backgroundColor: statusColorMap[key] }} />
              {label}
            </div>
          ))}
        </div>

        <Card className="overflow-hidden">
          <CardContent className="p-0" style={{ height: 580 }}>
            {isLoading ? (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                Buchungen werden geladen …
              </div>
            ) : (
              <MapContainer
                center={[54.1, 9.85]}
                zoom={10}
                style={{ height: "100%", width: "100%" }}
                scrollWheelZoom
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <FitBounds markers={markers} />
                {markers.map((m) => (
                  <Marker key={m.id} position={m.coords} icon={createColoredIcon(statusColorMap[m.status] ?? "#6b7280")}>
                    <Popup>
                      <div style={{ minWidth: 190, fontFamily: "sans-serif", fontSize: 13 }}>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>{m.childName}</div>
                        <div style={{ color: "#888", fontSize: 11, marginBottom: 6 }}>{m.referenceNumber}</div>
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                          <tbody>
                            <tr>
                              <td style={{ color: "#888", padding: "2px 6px 2px 0" }}>Klasse</td>
                              <td>{m.gradeYear}</td>
                            </tr>
                            <tr>
                              <td style={{ color: "#888", padding: "2px 6px 2px 0" }}>Elternteil</td>
                              <td>{m.parentName}</td>
                            </tr>
                            <tr>
                              <td style={{ color: "#888", padding: "2px 6px 2px 0" }}>Zone</td>
                              <td>{tariffZoneMap[m.tariffZone] ?? m.tariffZone}</td>
                            </tr>
                            <tr>
                              <td style={{ color: "#888", padding: "2px 6px 2px 0" }}>Status</td>
                              <td>
                                <span style={{ color: statusColorMap[m.status], fontWeight: 600 }}>
                                  {statusMap[m.status] ?? m.status}
                                </span>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                        <div style={{ marginTop: 8 }}>
                          <a href={`/admin/bookings/${m.id}`} style={{ color: "#004289", fontSize: 12 }}>
                            Details öffnen →
                          </a>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            )}
          </CardContent>
        </Card>

        {isGeocoding && totalToGeocode > 0 && (
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-[#004289] h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${(geocodedCount / totalToGeocode) * 100}%` }}
            />
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
