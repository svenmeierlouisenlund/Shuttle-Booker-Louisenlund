import { useGetAdminStats } from "@workspace/api-client-react";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Users, Euro, BusFront, Clock, MapPin } from "lucide-react";

function formatEuro(cents: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export default function AdminDashboard() {
  const { data: stats, isLoading } = useGetAdminStats();

  const topCities = stats?.byCity
    ? Object.entries(stats.byCity)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
    : [];

  const maxCityCount = topCities[0]?.[1] ?? 1;

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
            {Array.from({ length: 4 }).map((_, i) => (
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
