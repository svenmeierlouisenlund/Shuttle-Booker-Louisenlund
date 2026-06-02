import { useEffect, useRef, useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { useListAdminBookings } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Loader2, AlertCircle } from "lucide-react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const CACHE_KEY = "ll_geocode_cache";
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
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

async function geocodeAddress(address: string): Promise<[number, number] | null> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=de`;
  const res = await fetch(url, {
    headers: { "Accept-Language": "de", "User-Agent": "LouisenlundShuttle/1.0" },
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.length) return null;
  return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
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

export default function AdminMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const markersLayer = useRef<L.LayerGroup | null>(null);

  const [geocodedCount, setGeocodedCount] = useState(0);
  const [totalToGeocode, setTotalToGeocode] = useState(0);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [failedCount, setFailedCount] = useState(0);

  const { data, isLoading } = useListAdminBookings({ limit: 1000 });

  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;

    leafletMap.current = L.map(mapRef.current).setView([54.1, 9.85], 10);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(leafletMap.current);

    markersLayer.current = L.layerGroup().addTo(leafletMap.current);

    return () => {
      leafletMap.current?.remove();
      leafletMap.current = null;
    };
  }, []);

  useEffect(() => {
    if (!data?.bookings || !leafletMap.current || !markersLayer.current) return;

    const bookings = data.bookings;
    const cache = loadCache();
    const bounds: [number, number][] = [];

    markersLayer.current.clearLayers();

    const needsGeocode: typeof bookings = [];

    for (const booking of bookings) {
      const key = booking.childAddress;
      if (cache[key] !== undefined) {
        const coords = cache[key];
        if (coords) {
          addMarker(booking, coords);
          bounds.push(coords);
        }
      } else {
        needsGeocode.push(booking);
      }
    }

    if (bounds.length > 0 && leafletMap.current) {
      leafletMap.current.fitBounds(bounds, { padding: [40, 40] });
    }

    if (needsGeocode.length === 0) return;

    setTotalToGeocode(needsGeocode.length);
    setGeocodedCount(0);
    setFailedCount(0);
    setIsGeocoding(true);

    let i = 0;
    const newBounds = [...bounds];

    function processNext() {
      if (i >= needsGeocode.length) {
        setIsGeocoding(false);
        if (newBounds.length > 0 && leafletMap.current) {
          leafletMap.current.fitBounds(newBounds, { padding: [40, 40] });
        }
        return;
      }

      const booking = needsGeocode[i];
      i++;

      geocodeAddress(booking.childAddress).then((coords) => {
        cache[booking.childAddress] = coords;
        saveCache(cache);

        if (coords) {
          addMarker(booking, coords);
          newBounds.push(coords);
        } else {
          setFailedCount((n) => n + 1);
        }

        setGeocodedCount((n) => n + 1);
        setTimeout(processNext, GEOCODE_DELAY_MS);
      });
    }

    processNext();
  }, [data]);

  function addMarker(booking: NonNullable<typeof data>["bookings"][0], coords: [number, number]) {
    if (!markersLayer.current) return;
    const color = statusColorMap[booking.status] ?? "#6b7280";
    const icon = createColoredIcon(color);

    const popup = `
      <div style="min-width:200px;font-family:sans-serif;font-size:13px">
        <div style="font-weight:600;margin-bottom:4px">${booking.childName}</div>
        <div style="color:#666;margin-bottom:6px;font-size:11px">${booking.referenceNumber}</div>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="color:#888;padding:2px 6px 2px 0">Klasse</td><td>${booking.gradeYear}</td></tr>
          <tr><td style="color:#888;padding:2px 6px 2px 0">Elternteil</td><td>${booking.parentName}</td></tr>
          <tr><td style="color:#888;padding:2px 6px 2px 0">Zone</td><td>${tariffZoneMap[booking.tariffZone] ?? booking.tariffZone}</td></tr>
          <tr><td style="color:#888;padding:2px 6px 2px 0">Status</td><td><span style="color:${color};font-weight:600">${statusMap[booking.status] ?? booking.status}</span></td></tr>
        </table>
        <div style="margin-top:8px">
          <a href="/admin/bookings/${booking.id}" style="color:#004289;font-size:12px">Details öffnen →</a>
        </div>
      </div>
    `;

    L.marker(coords, { icon }).bindPopup(popup).addTo(markersLayer.current!);
  }

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="text-2xl font-serif font-semibold text-primary">Karte der Anmeldungen</h1>
          {!isLoading && data && (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <MapPin className="w-4 h-4" />
              <span>{data.total} Buchungen gesamt</span>
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

        <div className="flex gap-3 flex-wrap">
          {Object.entries(statusMap).map(([key, label]) => (
            <div key={key} className="flex items-center gap-1.5 text-sm">
              <span
                className="w-3 h-3 rounded-full inline-block"
                style={{ backgroundColor: statusColorMap[key] }}
              />
              {label}
            </div>
          ))}
        </div>

        <Card className="overflow-hidden">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="h-[600px] flex items-center justify-center text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                Buchungen werden geladen …
              </div>
            ) : (
              <div ref={mapRef} style={{ height: "600px", width: "100%" }} />
            )}
          </CardContent>
        </Card>

        {isGeocoding && (
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-[#004289] h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${totalToGeocode > 0 ? (geocodedCount / totalToGeocode) * 100 : 0}%` }}
            />
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
