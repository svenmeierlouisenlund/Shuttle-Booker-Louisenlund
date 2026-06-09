import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation, Link } from "wouter";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Loader2, Bus, ArrowLeft, Phone, User, MapPin, Users,
  Pencil, Check, X, Navigation, Home, School, ExternalLink, Clock,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useIsBusReadOnly } from "@/hooks/use-read-only";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// ── Destination helper ─────────────────────────────────────────────────────────
const GRADES_HOF = new Set(["Jahrgang 1","Jahrgang 2","Jahrgang 3","Jahrgang 4","Jahrgang 5","Jahrgang 6","Jahrgang 7"]);
function isHof(gradeYear: string): boolean { return GRADES_HOF.has(gradeYear); }
function DestBadge({ gradeYear }: { gradeYear: string }) {
  return isHof(gradeYear)
    ? <span className="inline-flex items-center px-1.5 py-0 rounded text-[10px] font-medium bg-green-100 text-green-700">Hof</span>
    : <span className="inline-flex items-center px-1.5 py-0 rounded text-[10px] font-medium bg-purple-100 text-purple-700">Schloss</span>;
}

// ── Passenger Detail Sheet ─────────────────────────────────────────────────────

const ROUTE_LABELS: Record<string, string> = {
  none: "Keine", zone1: "Zone 1", zone2: "Zone 2", zone3: "Zone 3",
  zone4: "Zone 4", zone5: "Zone 5",
};
const STATUS_LABELS: Record<string, string> = {
  eingegangen: "Eingegangen", geprueft: "Geprüft", bestaetigt: "Bestätigt",
  rueckfrage_offen: "Rückfrage offen", waitlisted: "Warteliste",
};
const TARIFF_LABELS: Record<string, string> = {
  zone1: "Zone 1", zone2: "Zone 2", zone3: "Zone 3", zone4: "Zone 4", zone5: "Zone 5",
};

function PassengerDetailSheet({
  passenger,
  onClose,
}: {
  passenger: PassengerDetail | null;
  onClose: () => void;
}) {
  if (!passenger) return null;
  const isSibling = passenger.type === "sibling";
  const addr = [passenger.pickupAddress, passenger.pickupPostalCode, passenger.pickupCity].filter(Boolean).join(", ");

  return (
    <Sheet open={!!passenger} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2 text-[#004289]">
            <User className="w-5 h-5" />
            {passenger.childName}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-5">
          {/* Kind */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Kind</p>
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Name</span>
                <span className="font-medium text-gray-900">{passenger.childName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Jahrgang</span>
                <span className="font-medium text-gray-900 flex items-center gap-1.5">
                  {passenger.gradeYear}
                  <DestBadge gradeYear={passenger.gradeYear} />
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Referenz</span>
                <span className="font-mono text-xs text-gray-700">{passenger.referenceNumber}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Status</span>
                <span className="font-medium text-gray-900">{STATUS_LABELS[passenger.status] ?? passenger.status}</span>
              </div>
            </div>
          </div>

          {/* Routen */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Routen</p>
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Hinfahrt</span>
                <span className="font-medium text-gray-900">{ROUTE_LABELS[passenger.outboundRoute] ?? passenger.outboundRoute}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Rückfahrt</span>
                <span className="font-medium text-gray-900">{ROUTE_LABELS[passenger.returnRoute] ?? passenger.returnRoute}</span>
              </div>
              {!isSibling && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Tarifstufe</span>
                  <span className="font-medium text-gray-900">{TARIFF_LABELS[passenger.tariffZone] ?? passenger.tariffZone}</span>
                </div>
              )}
            </div>
          </div>

          {/* Abholadresse */}
          {!!addr && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Abholadresse</p>
              <p className="text-sm text-gray-800">{addr}</p>
            </div>
          )}

          {/* Erziehungsberechtigte */}
          {passenger.parentName && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Erziehungsberechtigte</p>
              <div className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Name</span>
                  <span className="font-medium text-gray-900">{passenger.parentName}</span>
                </div>
                {passenger.parentPhone && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Telefon</span>
                    <a href={`tel:${passenger.parentPhone}`} className="font-medium text-[#004289] hover:underline">
                      {passenger.parentPhone}
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Link zur Buchung */}
          <div className="pt-2 border-t border-gray-100">
            <Link href={`/admin/bookings/${passenger.bookingId}`}>
              <Button variant="outline" size="sm" className="w-full gap-2 text-[#004289] border-[#004289]/30 hover:bg-[#004289]/5">
                <ExternalLink className="w-3.5 h-3.5" />
                Zur vollständigen Buchung
              </Button>
            </Link>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface BusDetail {
  id: number;
  name: string;
  capacity: number;
  notes: string | null;
  driverName: string | null;
  driverPhone: string | null;
}

interface PassengerDetail {
  type: "booking" | "sibling";
  id: number;
  bookingId: number;
  childName: string;
  gradeYear: string;
  childAddress: string;
  childPostalCode: string;
  childCity: string;
  pickupAddress: string | null;
  pickupPostalCode: string | null;
  pickupCity: string | null;
  pickupLat: number | null;
  pickupLng: number | null;
  tariffZone: string;
  outboundRoute: string;
  returnRoute: string;
  referenceNumber: string;
  parentName: string;
  parentPhone: string;
  status: string;
}

interface ReturnTimeEntry {
  type: "booking" | "sibling";
  id: number;
  weekday: string;
  returnTime: string;
}

interface BusDetailResponse {
  bus: BusDetail;
  passengers: PassengerDetail[];
  returnTimeAssignments: ReturnTimeEntry[];
}

// ── Pickup stop (siblings grouped) ────────────────────────────────────────────

interface PickupStop {
  bookingId: number;
  address: string;
  postalCode: string;
  city: string;
  coords?: [number, number];
  children: PassengerDetail[];
  parentName: string;
  parentPhone: string;
  outboundRoute: string;
  returnRoute: string;
  referenceNumber: string;
}

/** Effective pickup address: uses Sammelpunkt/Pin if set, otherwise Heimadresse */
function effectiveAddress(p: PassengerDetail) {
  const hasPin = p.pickupLat !== null && p.pickupLng !== null;
  const hasAddr = !!p.pickupAddress;
  if (hasAddr || hasPin) {
    return {
      address: p.pickupAddress ?? (hasPin ? "Kartenmarkierung" : ""),
      postalCode: p.pickupPostalCode ?? p.childPostalCode,
      city: p.pickupCity ?? p.childCity,
      isPickup: true,
      lat: p.pickupLat,
      lng: p.pickupLng,
    };
  }
  return { address: p.childAddress, postalCode: p.childPostalCode, city: p.childCity, isPickup: false, lat: null as null, lng: null as null };
}

function buildStops(passengers: PassengerDetail[]): PickupStop[] {
  const map = new Map<number, PickupStop>();

  for (const p of passengers) {
    if (p.type === "booking") {
      const ea = effectiveAddress(p);
      map.set(p.bookingId, {
        bookingId: p.bookingId,
        address: ea.address,
        postalCode: ea.postalCode,
        city: ea.city,
        coords: ea.lat !== null && ea.lng !== null ? [ea.lat, ea.lng] : undefined,
        children: [p],
        parentName: p.parentName,
        parentPhone: p.parentPhone,
        outboundRoute: p.outboundRoute,
        returnRoute: p.returnRoute,
        referenceNumber: p.referenceNumber,
      });
    }
  }
  for (const p of passengers) {
    if (p.type === "sibling") {
      const stop = map.get(p.bookingId);
      if (stop) {
        stop.children.push(p);
      } else {
        const ea = effectiveAddress(p);
        map.set(-p.id, {
          bookingId: p.bookingId,
          address: ea.address,
          postalCode: ea.postalCode,
          city: ea.city,
          coords: ea.lat !== null && ea.lng !== null ? [ea.lat, ea.lng] : undefined,
          children: [p],
          parentName: p.parentName,
          parentPhone: p.parentPhone,
          outboundRoute: p.outboundRoute,
          returnRoute: p.returnRoute,
          referenceNumber: p.referenceNumber,
        });
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => a.postalCode.localeCompare(b.postalCode));
}

// ── Geocoding ──────────────────────────────────────────────────────────────────

const GEOCACHE_KEY = "ll_geocode_cache_v4";

// Stiftung Louisenlund — fester Startpunkt des Shuttles
const LOUISENLUND_ADDR = "Louisenlund 9, 24357 Güby, Deutschland";

function getCache(): Record<string, [number, number]> {
  try { return JSON.parse(localStorage.getItem(GEOCACHE_KEY) ?? "{}"); } catch { return {}; }
}
function saveCache(c: Record<string, [number, number]>) {
  try { localStorage.setItem(GEOCACHE_KEY, JSON.stringify(c)); } catch { /* ignore */ }
}

async function geocodeSingle(addr: string): Promise<[number, number] | null> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(addr)}&format=json&limit=1&countrycodes=de`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Louisenlund-Shuttle/1.0" } });
    const data = await res.json();
    if (data[0]) return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
  } catch { /* ignore */ }
  return null;
}

/** Geocodiert eine Adresse. Fällt auf Straße+PLZ zurück wenn Ort nicht erkannt wird. */
async function geocodeAddress(
  address: string,
  postalCode: string,
  city: string,
): Promise<[number, number] | null> {
  const full = `${address}, ${postalCode} ${city}, Deutschland`;
  const result = await geocodeSingle(full);
  if (result) return result;
  // Fallback: nur Straße + PLZ (ohne Ortsname — hilft bei kleinen Ortsteilen)
  await new Promise(r => setTimeout(r, 1100));
  return geocodeSingle(`${address}, ${postalCode}, Deutschland`);
}

/** Haversine-Distanz in km zwischen zwei Koordinaten */
function haversineKm([lat1, lon1]: [number, number], [lat2, lon2]: [number, number]): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Map helpers ────────────────────────────────────────────────────────────────

const startIcon = L.divIcon({
  className: "",
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16],
  html: `<div style="background:#15803d;color:#fff;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;border:2px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.5)">S</div>`,
});

function createIcon(n: number, multi: boolean) {
  const bg = multi ? "#b45309" : "#004289";
  return L.divIcon({
    className: "",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
    html: `<div style="background:${bg};color:#fff;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)">${n}</div>`,
  });
}

function FitBounds({ coords }: { coords: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (coords.length === 0) return;
    if (coords.length === 1) { map.setView(coords[0], 12); return; }
    map.fitBounds(L.latLngBounds(coords), { padding: [40, 40] });
  }, [coords, map]);
  return null;
}

// ── Route Map ─────────────────────────────────────────────────────────────────

function RouteMap({ passengers }: { passengers: PassengerDetail[] }) {
  const rawStops = buildStops(passengers);

  const [louisenlundCoords, setLouisenlundCoords] = useState<[number, number] | null>(null);
  const [markers, setMarkers] = useState<{ stop: PickupStop; coords: [number, number]; order: number; distKm: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(0);
  const cache = useRef(getCache());

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setDone(0);

      // 1. Louisenlund zuerst geocodieren (gecacht nach erstem Mal)
      let llCoords: [number, number] | null = cache.current[LOUISENLUND_ADDR] ?? null;
      if (!llCoords) {
        llCoords = await geocodeSingle(LOUISENLUND_ADDR);
        if (llCoords) {
          cache.current[LOUISENLUND_ADDR] = llCoords;
          saveCache(cache.current);
        }
        await new Promise(r => setTimeout(r, 1100));
      }
      if (!cancelled) setLouisenlundCoords(llCoords);

      if (rawStops.length === 0) { if (!cancelled) setLoading(false); return; }

      // 2. Alle Haltepunkte geocodieren (oder direkte Koordinaten nutzen)
      const withCoords: { stop: PickupStop; coords: [number, number]; distKm: number }[] = [];
      let counter = 0;
      for (const stop of rawStops) {
        if (cancelled) break;

        let coords: [number, number] | null = null;

        if (stop.coords) {
          // Gespeicherte Koordinaten aus dem Kartenpin — kein Geocoding nötig
          coords = stop.coords;
        } else if (stop.address && stop.address !== "Kartenmarkierung") {
          const cacheKey = `${stop.address}, ${stop.postalCode} ${stop.city}, Deutschland`;
          coords = cache.current[cacheKey] ?? null;
          if (!coords) {
            coords = await geocodeAddress(stop.address, stop.postalCode, stop.city);
            if (coords) {
              cache.current[cacheKey] = coords;
              saveCache(cache.current);
            }
            await new Promise(r => setTimeout(r, 1100));
          }
        }

        counter++;
        if (!cancelled) setDone(counter);
        if (coords) {
          const distKm = llCoords ? haversineKm(llCoords, coords) : 0;
          withCoords.push({ stop, coords, distKm });
        }
      }

      // 3. Sortierung: weitester Halt zuerst (Rückweg von Louisenlund)
      withCoords.sort((a, b) => b.distKm - a.distKm);

      if (!cancelled) {
        setMarkers(withCoords.map((m, i) => ({ ...m, order: i + 1 })));
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passengers]);

  const allCoords: [number, number][] = [
    ...(louisenlundCoords ? [louisenlundCoords] : []),
    ...markers.map(m => m.coords),
  ];
  const multi = (stop: PickupStop) => stop.children.length > 1;

  return (
    <div className="space-y-3">
      {loading && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Adressen werden geocodiert … {done}/{rawStops.length}
        </div>
      )}
      <div className="rounded-lg overflow-hidden border border-gray-200" style={{ height: 460 }}>
        <MapContainer center={[54.5, 9.7]} zoom={9} style={{ height: "100%", width: "100%" }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          <FitBounds coords={allCoords} />

          {/* Louisenlund — Startpunkt */}
          {louisenlundCoords && (
            <Marker position={louisenlundCoords} icon={startIcon}>
              <Popup>
                <div className="text-sm space-y-0.5">
                  <p className="font-bold text-green-700">🏫 Stiftung Louisenlund</p>
                  <p className="text-gray-600 text-xs">Louisenlund 9, 24357 Güby</p>
                  <p className="text-gray-500 text-xs italic">Abfahrt / Rückkehr des Shuttles</p>
                </div>
              </Popup>
            </Marker>
          )}

          {/* Schüler-Haltepunkte */}
          {markers.map(m => (
            <Marker key={m.stop.bookingId} position={m.coords} icon={createIcon(m.order, multi(m.stop))}>
              <Popup>
                <div className="text-sm space-y-1.5" style={{ minWidth: 190 }}>
                  <p className="font-semibold text-[#004289]">
                    Haltepunkt {m.order}
                    {multi(m.stop) && <span className="ml-1 text-amber-700 text-xs">(Geschwister)</span>}
                  </p>
                  <p className="text-gray-500 text-xs">{m.distKm.toFixed(1)} km von Louisenlund</p>
                  <p className="text-gray-600 text-xs">{m.stop.address}, {m.stop.postalCode} {m.stop.city}</p>
                  <div className="border-t border-gray-100 pt-1 space-y-0.5">
                    {m.stop.children.map(c => (
                      <p key={`${c.type}-${c.id}`} className="text-gray-800 text-xs">
                        {c.type === "sibling" ? "↳ " : ""}
                        <span className="font-medium">{c.childName}</span>
                        <span className="text-gray-400"> · {c.gradeYear} · </span><DestBadge gradeYear={c.gradeYear} />
                      </p>
                    ))}
                  </div>
                  {m.stop.parentPhone && (
                    <p className="text-gray-600 text-xs">📞 {m.stop.parentName}: {m.stop.parentPhone}</p>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Legende */}
      <div className="space-y-1">
        {/* Start */}
        <div className="flex items-start gap-2 text-xs text-gray-600">
          <span className="w-5 h-5 rounded-full bg-green-700 text-white flex items-center justify-center shrink-0 text-[10px] font-black mt-0.5">
            S
          </span>
          <div>
            <span className="font-semibold text-green-700">Stiftung Louisenlund</span>
            <span className="text-gray-400"> · Start &amp; Ziel</span>
          </div>
        </div>
        {/* Stops */}
        {markers.map(m => (
          <div key={m.stop.bookingId} className="flex items-start gap-2 text-xs text-gray-600">
            <span
              className="w-5 h-5 rounded-full text-white flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5"
              style={{ background: multi(m.stop) ? "#b45309" : "#004289" }}
            >
              {m.order}
            </span>
            <div>
              <span className="font-medium">{m.stop.postalCode} {m.stop.city}</span>
              <span className="text-gray-400"> ({m.distKm.toFixed(1)} km) · </span>
              {m.stop.children.map((c, i) => (
                <span key={`${c.type}-${c.id}`}>
                  {i > 0 && <span className="text-gray-400"> &amp; </span>}
                  {c.childName}
                </span>
              ))}
              {multi(m.stop) && (
                <span className="ml-1.5 text-amber-700 bg-amber-50 rounded px-1">Geschwister</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Inline Edit Field ──────────────────────────────────────────────────────────

function EditableField({
  label, value, icon, onSave, saving, placeholder, readOnly = false,
}: {
  label: string; value: string | null; icon: React.ReactNode;
  onSave: (v: string) => void; saving: boolean; placeholder?: string;
  readOnly?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");

  useEffect(() => { setDraft(value ?? ""); }, [value]);

  const commit = () => { onSave(draft); setEditing(false); };
  const cancel = () => { setDraft(value ?? ""); setEditing(false); };

  if (editing && !readOnly) {
    return (
      <div className="space-y-1">
        <Label className="text-xs text-gray-500">{label}</Label>
        <div className="flex items-center gap-1">
          <Input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            className="h-8 text-sm"
            autoFocus
            placeholder={placeholder}
            onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") cancel(); }}
          />
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={commit} disabled={saving}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5 text-green-600" />}
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={cancel}>
            <X className="w-3.5 h-3.5 text-gray-400" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Label className="text-xs text-gray-500">{label}</Label>
      {readOnly ? (
        <div className="flex items-center gap-2 text-sm w-full">
          <span className="text-gray-400">{icon}</span>
          <span className={value ? "text-gray-900" : "text-gray-400 italic"}>
            {value || placeholder || "–"}
          </span>
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="flex items-center gap-2 text-sm group w-full text-left"
        >
          <span className="text-gray-400">{icon}</span>
          <span className={value ? "text-gray-900" : "text-gray-400 italic"}>
            {value || placeholder || "–"}
          </span>
          <Pencil className="w-3 h-3 text-gray-300 group-hover:text-gray-500 ml-auto shrink-0" />
        </button>
      )}
    </div>
  );
}

// ── Route labels ───────────────────────────────────────────────────────────────

const zoneLabel: Record<string, string> = { zone1: "Zone 1", zone2: "Zone 2", zone3: "Zone 3", none: "–" };
function routeSummary(p: { outboundRoute: string; returnRoute: string }) {
  const out = zoneLabel[p.outboundRoute] ?? p.outboundRoute;
  const ret = zoneLabel[p.returnRoute] ?? p.returnRoute;
  return p.outboundRoute === p.returnRoute ? out : `Hin: ${out} · Rück: ${ret}`;
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function BusDetail() {
  const isReadOnly = useIsBusReadOnly();
  const params = useParams<{ id: string }>();
  const busId = parseInt(params.id ?? "", 10);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"passengers" | "route" | "returntimes">("passengers");
  const [selectedPassenger, setSelectedPassenger] = useState<PassengerDetail | null>(null);

  const { data, isLoading, error } = useQuery<BusDetailResponse>({
    queryKey: ["bus-detail", busId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/buses/${busId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Fehler beim Laden");
      return res.json();
    },
    enabled: !isNaN(busId),
  });

  const updateMutation = useMutation({
    mutationFn: async (fields: Record<string, string | number | null>) => {
      const res = await fetch(`/api/admin/buses/${busId}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Fehler");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bus-detail", busId] });
      queryClient.invalidateQueries({ queryKey: ["admin-buses"] });
    },
    onError: (err: Error) => toast({ title: "Fehler", description: err.message, variant: "destructive" }),
  });

  const returnTimeMutation = useMutation({
    mutationFn: async (payload: { type: "booking" | "sibling"; id: number; weekday: string; returnTime: string | null }) => {
      const res = await fetch(`/api/admin/buses/${busId}/return-times`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Fehler");
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bus-detail", busId] }),
    onError: (err: Error) => toast({ title: "Fehler", description: err.message, variant: "destructive" }),
  });

  if (isLoading) return (
    <AdminLayout>
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#004289]" />
      </div>
    </AdminLayout>
  );

  if (error || !data) return (
    <AdminLayout>
      <div className="text-center py-20 text-red-600">Bus nicht gefunden.</div>
    </AdminLayout>
  );

  const { bus, passengers } = data;
  const pct = Math.min(100, Math.round((passengers.length / bus.capacity) * 100));
  const hofCount = passengers.filter(p => isHof(p.gradeYear)).length;
  const schlossCount = passengers.length - hofCount;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <button
          onClick={() => navigate("/admin/buses")}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#004289] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Alle Busse
        </button>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#004289]/10 flex items-center justify-center shrink-0">
              <Bus className="w-5 h-5 text-[#004289]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#004289]">{bus.name}</h1>
              <p className="text-gray-500 text-sm">
                {passengers.length} von {bus.capacity} Plätzen belegt
              </p>
            </div>
          </div>
          <Badge
            variant={passengers.length >= bus.capacity ? "destructive" : "secondary"}
            className="text-sm px-3 py-1"
          >
            {passengers.length}/{bus.capacity}
          </Badge>
        </div>

        {/* Capacity bar */}
        <div className="h-2 rounded-full bg-gray-100">
          <div
            className={`h-2 rounded-full transition-all ${passengers.length >= bus.capacity ? "bg-orange-500" : "bg-[#004289]"}`}
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Destination counts */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm text-gray-500">Zielorte:</span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-700">
            <School className="w-3.5 h-3.5" />
            Schloss Louisenlund — {schlossCount} Schüler
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700">
            <Home className="w-3.5 h-3.5" />
            Hof Louisenlund — {hofCount} Schüler
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Driver info card */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <User className="w-4 h-4" />
                Fahrer
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <EditableField
                label="Name"
                value={bus.driverName}
                icon={<User className="w-3.5 h-3.5" />}
                placeholder="Name des Fahrers"
                saving={updateMutation.isPending}
                onSave={v => updateMutation.mutate({ driverName: v })}
                readOnly={isReadOnly}
              />
              <EditableField
                label="Telefon / Rufnummer"
                value={bus.driverPhone}
                icon={<Phone className="w-3.5 h-3.5" />}
                placeholder="Rufnummer"
                saving={updateMutation.isPending}
                onSave={v => updateMutation.mutate({ driverPhone: v })}
                readOnly={isReadOnly}
              />
              {bus.notes && (
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-xs text-gray-500 mb-1">Notizen</p>
                  <p className="text-sm text-gray-700">{bus.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Passengers + Route */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-0">
              <div className="flex gap-1 border-b border-gray-100 pb-0">
                <button
                  onClick={() => setActiveTab("passengers")}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                    activeTab === "passengers"
                      ? "border-[#004289] text-[#004289]"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    Schüler ({passengers.length})
                  </span>
                </button>
                <button
                  onClick={() => setActiveTab("route")}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                    activeTab === "route"
                      ? "border-[#004289] text-[#004289]"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <Navigation className="w-3.5 h-3.5" />
                    Routenplanung
                  </span>
                </button>
                <button
                  onClick={() => setActiveTab("returntimes")}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                    activeTab === "returntimes"
                      ? "border-[#004289] text-[#004289]"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    Rückfahrtzeiten
                  </span>
                </button>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {activeTab === "passengers" && (() => {
                const stops = buildStops(passengers);
                return (
                  <div className="space-y-3">
                    {stops.length === 0 ? (
                      <p className="text-sm text-gray-400 italic text-center py-6">
                        Keine Schüler zugeordnet.
                      </p>
                    ) : (
                      stops.map((stop, idx) => {
                        const isMulti = stop.children.length > 1;
                        return (
                          <div
                            key={stop.bookingId}
                            className={`rounded-lg border overflow-hidden ${
                              isMulti ? "border-amber-200" : "border-gray-100"
                            }`}
                          >
                            {/* Stop header */}
                            <div className={`flex items-center gap-2.5 px-3 py-2 ${isMulti ? "bg-amber-50" : "bg-gray-50"}`}>
                              <span
                                className="w-6 h-6 rounded-full text-white flex items-center justify-center text-xs font-bold shrink-0"
                                style={{ background: isMulti ? "#b45309" : "#004289" }}
                              >
                                {idx + 1}
                              </span>
                              <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-medium text-gray-700 flex items-center gap-1">
                                  <Home className="w-3 h-3 text-gray-400" />
                                  {stop.address}{stop.address && ","} {stop.postalCode} {stop.city}
                                </span>
                                {isMulti && (
                                  <Badge className="text-[10px] h-4 px-1 bg-amber-100 text-amber-800 border-0">
                                    {stop.children.length} Geschwister
                                  </Badge>
                                )}
                              </div>
                              {stop.parentPhone && (
                                <span className="text-xs text-gray-500 flex items-center gap-1 shrink-0">
                                  <Phone className="w-3 h-3" />
                                  {stop.parentName}
                                </span>
                              )}
                            </div>
                            {/* Children */}
                            <div className="divide-y divide-gray-50">
                              {stop.children.map((p, ci) => (
                                <div
                                  key={`${p.type}-${p.id}`}
                                  onClick={() => setSelectedPassenger(p)}
                                  className={`flex items-start gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors ${
                                    p.type === "sibling" ? "pl-8" : ""
                                  }`}
                                >
                                  {p.type === "sibling" && (
                                    <span className="text-gray-300 text-sm -ml-4 mr-0 mt-0.5 shrink-0">↳</span>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <p className="text-sm font-semibold text-gray-900">{p.childName}</p>
                                      {p.type === "sibling" && (
                                        <Badge className="text-[10px] h-4 px-1 bg-blue-100 text-blue-700 border-0">
                                          Geschwister
                                        </Badge>
                                      )}
                                      <span className="text-xs text-gray-400">{p.gradeYear}</span>
                                      <span className="text-xs text-gray-400">·</span>
                                      <DestBadge gradeYear={p.gradeYear} />
                                      <span className="text-xs text-gray-400">·</span>
                                      <span className="text-xs text-gray-400">{p.referenceNumber}</span>
                                    </div>
                                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                                      <span className="text-xs text-gray-500 flex items-center gap-1">
                                        <MapPin className="w-3 h-3" />
                                        {routeSummary(p)}
                                      </span>
                                    </div>
                                  </div>
                                  {ci === 0 && stop.parentPhone && (
                                    <span className="text-xs text-gray-400 shrink-0">{stop.parentPhone}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                );
              })()}

              {activeTab === "route" && (
                <div>
                  {passengers.length === 0 ? (
                    <p className="text-sm text-gray-400 italic text-center py-6">
                      Keine Schüler zugeordnet — keine Route verfügbar.
                    </p>
                  ) : (
                    <>
                      <p className="text-xs text-gray-500 mb-3">
                        Schüler sind nach Postleitzahl sortiert. Klicken Sie auf einen Marker für Details.
                      </p>
                      <RouteMap passengers={passengers} />
                    </>
                  )}
                </div>
              )}

              {activeTab === "returntimes" && (() => {
                const rta = data.returnTimeAssignments ?? [];
                // Build lookup: key = `${type}-${id}-${weekday}` → returnTime
                const rtaMap = new Map<string, string>();
                for (const r of rta) rtaMap.set(`${r.type}-${r.id}-${r.weekday}`, r.returnTime);

                const WEEKDAYS: { key: string; label: string }[] = [
                  { key: "mon", label: "Mo" },
                  { key: "tue", label: "Di" },
                  { key: "wed", label: "Mi" },
                  { key: "thu", label: "Do" },
                  { key: "fri", label: "Fr" },
                ];
                const TIMES = ["14:30", "16:30"];

                // Only show passengers with a return route
                const returnPassengers = passengers.filter(p => p.returnRoute !== "none");

                if (returnPassengers.length === 0) {
                  return (
                    <p className="text-sm text-gray-400 italic text-center py-6">
                      Keine Schüler mit Rückfahrt zugeordnet.
                    </p>
                  );
                }

                return (
                  <div className="overflow-x-auto">
                    <p className="text-xs text-gray-500 mb-3">
                      Klicken Sie auf eine Zeit um sie zu setzen — nochmal klicken hebt die Auswahl auf.
                    </p>
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr>
                          <th className="text-left text-xs font-medium text-gray-500 pb-2 pr-3 min-w-[140px]">Schüler</th>
                          {WEEKDAYS.map(d => (
                            <th key={d.key} className="text-center text-xs font-medium text-gray-500 pb-2 px-1 min-w-[80px]">{d.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {returnPassengers.map(p => (
                          <tr key={`${p.type}-${p.id}`}>
                            <td className="py-2 pr-3">
                              <div className="flex items-center gap-1.5">
                                {p.type === "sibling" && <span className="text-gray-300 text-xs">↳</span>}
                                <span className="font-medium text-gray-800 text-xs leading-tight">{p.childName}</span>
                                <DestBadge gradeYear={p.gradeYear} />
                              </div>
                            </td>
                            {WEEKDAYS.map(d => {
                              const current = rtaMap.get(`${p.type}-${p.id}-${d.key}`);
                              return (
                                <td key={d.key} className="py-1.5 px-1">
                                  <div className="flex flex-col gap-0.5 items-center">
                                    {TIMES.map(t => {
                                      const active = current === t;
                                      return (
                                        <button
                                          key={t}
                                          disabled={isReadOnly || returnTimeMutation.isPending}
                                          onClick={() => returnTimeMutation.mutate({
                                            type: p.type,
                                            id: p.id,
                                            weekday: d.key,
                                            returnTime: active ? null : t,
                                          })}
                                          className={`text-[11px] px-2 py-0.5 rounded font-medium transition-colors w-full ${
                                            active
                                              ? "bg-[#004289] text-white"
                                              : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                                          } ${isReadOnly ? "cursor-default opacity-60" : "cursor-pointer"}`}
                                        >
                                          {t}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </div>
      </div>
      <PassengerDetailSheet
        passenger={selectedPassenger}
        onClose={() => setSelectedPassenger(null)}
      />
    </AdminLayout>
  );
}
