import { useGetAdminStats } from "@workspace/api-client-react";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Users, Euro, BusFront, Clock, MapPin, ChevronDown, ChevronUp, Sun } from "lucide-react";
import { useIsFahrer } from "@/hooks/use-read-only";
import { useState } from "react";

function formatEuro(cents: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

const WEEKDAYS = [
  { key: "mon", label: "Mo" },
  { key: "tue", label: "Di" },
  { key: "wed", label: "Mi" },
  { key: "thu", label: "Do" },
  { key: "fri", label: "Fr" },
];
const TIMES = ["14:30", "16:30"];

type BusEntry = {
  id: number;
  name: string;
  capacity: number;
  assigned: number;
  freeSeats: number;
  returnTimes: Record<string, Record<string, number>>;
};

function BusRow({ bus }: { bus: BusEntry }) {
  const [open, setOpen] = useState(false);
  const pct = bus.capacity > 0 ? (bus.assigned / bus.capacity) * 100 : 0;
  const full = bus.freeSeats <= 0;

  // Check if any return times are set
  const hasReturnTimes = Object.keys(bus.returnTimes).length > 0;

  return (
    <div className="rounded-md border border-gray-100 overflow-hidden">
      {/* Main row — always visible */}
      <button
        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 transition-colors text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="w-32 text-sm text-right text-muted-foreground shrink-0">
          {bus.name}
        </div>
        <div className="flex-1 h-4 bg-muted rounded-sm overflow-hidden">
          <div
            className={`h-full rounded-sm transition-all ${full ? "bg-destructive" : "bg-primary"}`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
        <div className="w-32 text-sm text-right shrink-0 tabular-nums">
          <span className="font-medium">{bus.assigned}</span>
          <span className="text-muted-foreground">/{bus.capacity}</span>
          {bus.freeSeats > 0 ? (
            <span className="text-muted-foreground ml-1">({bus.freeSeats} frei)</span>
          ) : (
            <span className="text-destructive ml-1 font-medium">voll</span>
          )}
        </div>
        <div className="shrink-0 text-muted-foreground">
          {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </div>
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 space-y-4">
          {/* Morning */}
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Sun className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Morgenfahrt</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-3 bg-gray-200 rounded-sm overflow-hidden">
                <div
                  className={`h-full rounded-sm transition-all ${full ? "bg-destructive" : "bg-primary"}`}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
              <span className="text-sm tabular-nums text-gray-700">
                <span className="font-medium">{bus.assigned}</span>
                <span className="text-gray-400">/{bus.capacity} Plätze belegt</span>
              </span>
            </div>
          </div>

          {/* Return times */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Clock className="w-3.5 h-3.5 text-[#004289]" />
              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Rückfahrten</span>
            </div>
            {hasReturnTimes ? (
              <table className="text-xs w-full border-collapse">
                <thead>
                  <tr>
                    <th className="text-left text-gray-400 font-medium pb-1 pr-3 w-12"></th>
                    {WEEKDAYS.map(d => (
                      <th key={d.key} className="text-center text-gray-500 font-medium pb-1 px-2">{d.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TIMES.map(t => (
                    <tr key={t}>
                      <td className="text-gray-500 pr-3 py-0.5 font-medium">{t}</td>
                      {WEEKDAYS.map(d => {
                        const cnt = bus.returnTimes[d.key]?.[t] ?? 0;
                        return (
                          <td key={d.key} className="text-center py-0.5 px-2">
                            {cnt > 0 ? (
                              <span className="inline-flex items-center justify-center w-6 h-5 rounded bg-[#004289] text-white font-semibold text-[11px]">
                                {cnt}
                              </span>
                            ) : (
                              <span className="text-gray-300">–</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-xs text-gray-400 italic">Noch keine Rückfahrtzeiten eingetragen.</p>
            )}
          </div>

          <div className="pt-1">
            <Link href={`/admin/buses/${bus.id}`}>
              <Button variant="outline" size="sm" className="text-xs h-7 text-[#004289] border-[#004289]/30 hover:bg-[#004289]/5">
                Bus-Detailseite öffnen →
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const { data: stats, isLoading } = useGetAdminStats();
  const isFahrer = useIsFahrer();

  const topCities = stats?.byCity
    ? Object.entries(stats.byCity).sort((a, b) => b[1] - a[1])
    : [];
  const maxCityCount = topCities[0]?.[1] ?? 1;
  const busOccupancy = (stats?.busOccupancy ?? []) as BusEntry[];

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-serif font-semibold text-primary">Dashboard</h1>
          <Link href="/admin/bookings">
            <Button>Alle Buchungen</Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {Array.from({ length: isFahrer ? 3 : 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Buchungen gesamt
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary">{stats?.totalChildren ?? 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats?.totalBookings ?? 0} Hauptbuchungen
                </p>
              </CardContent>
            </Card>

            {!isFahrer && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Euro className="h-4 w-4" />
                    Gesamtumsatz
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-primary">
                    {formatEuro(stats?.totalRevenueCents ?? 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">alle Buchungen inkl. Geschwister</p>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <BusFront className="h-4 w-4" />
                  Freie Shuttleplätze
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary">{stats?.freeSeats ?? 0}</div>
                <p className="text-xs text-muted-foreground mt-1">in regulären Bussen</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Warteliste
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary">{stats?.waitlistCount ?? 0}</div>
                <p className="text-xs text-muted-foreground mt-1">Kinder auf der Warteliste</p>
              </CardContent>
            </Card>
          </div>
        )}

        {isLoading ? (
          <Skeleton className="h-48" />
        ) : busOccupancy.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <BusFront className="h-4 w-4" />
                Belegung der Busse
              </CardTitle>
              <p className="text-xs text-muted-foreground">Klicken Sie auf einen Bus für Morgen- und Rückfahrt-Details.</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {busOccupancy.map(bus => (
                  <BusRow key={bus.id} bus={bus} />
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {isLoading ? (
          <Skeleton className="h-64" />
        ) : topCities.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Wohnorte der Kinder
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {topCities.map(([city, count]) => (
                  <div key={city} className="flex items-center gap-3">
                    <div className="w-32 text-sm text-right text-muted-foreground truncate shrink-0">
                      {city}
                    </div>
                    <div className="flex-1 h-5 bg-muted rounded-sm overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-sm transition-all"
                        style={{ width: `${(count / maxCityCount) * 100}%` }}
                      />
                    </div>
                    <div className="w-6 text-sm font-medium text-right shrink-0">{count}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </AdminLayout>
  );
}
