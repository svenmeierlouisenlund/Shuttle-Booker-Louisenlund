import { useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { useListAdminBookings } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

const statusMap: Record<string, string> = {
  received: "Eingegangen",
  reviewed: "Geprüft",
  confirmed: "Bestätigt",
  query_open: "Rückfrage offen"
};

const statusColorMap: Record<string, string> = {
  received: "bg-blue-100 text-blue-800 border-blue-200",
  reviewed: "bg-amber-100 text-amber-800 border-amber-200",
  confirmed: "bg-green-100 text-green-800 border-green-200",
  query_open: "bg-red-100 text-red-800 border-red-200"
};

const tariffZoneMap: Record<string, string> = {
  zone1: "Tarifzone 1",
  zone2: "Tarifzone 2",
  zone3: "Tarifzone 3"
};

const bookingTypeMap: Record<string, string> = {
  full_year: "Gesamtes Schuljahr 2026/27",
  first_half: "1. Schulhalbjahr 2026/27"
};

export default function AdminBookingsList() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>("all");
  const [tariffZone, setTariffZone] = useState<string>("all");

  const queryParams = {
    page,
    limit: 50,
    ...(status !== "all" ? { status } : {}),
    ...(tariffZone !== "all" ? { tariffZone } : {})
  };

  const { data, isLoading } = useListAdminBookings(queryParams);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="text-2xl font-serif font-semibold text-primary">Alle Buchungen</h1>
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => window.open("/api/admin/bookings/export?format=xlsx", "_blank")}>
              Excel Export
            </Button>
            <Button variant="outline" onClick={() => window.open("/api/admin/bookings/export", "_blank")}>
              CSV Export
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center gap-4 py-4 bg-muted/50 border-b">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Status:</span>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-[180px] bg-background">
                  <SelectValue placeholder="Alle Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Status</SelectItem>
                  <SelectItem value="received">Eingegangen</SelectItem>
                  <SelectItem value="reviewed">Geprüft</SelectItem>
                  <SelectItem value="confirmed">Bestätigt</SelectItem>
                  <SelectItem value="query_open">Rückfrage offen</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Tarifzone:</span>
              <Select value={tariffZone} onValueChange={setTariffZone}>
                <SelectTrigger className="w-[180px] bg-background">
                  <SelectValue placeholder="Alle Zonen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Zonen</SelectItem>
                  <SelectItem value="zone1">Tarifzone 1</SelectItem>
                  <SelectItem value="zone2">Tarifzone 2</SelectItem>
                  <SelectItem value="zone3">Tarifzone 3</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : data?.bookings.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                Keine Buchungen gefunden.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ref</TableHead>
                    <TableHead>Datum</TableHead>
                    <TableHead>Kind</TableHead>
                    <TableHead>Klasse</TableHead>
                    <TableHead>Eltern</TableHead>
                    <TableHead>Zone</TableHead>
                    <TableHead>Typ</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aktion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.bookings.map((booking) => (
                    <TableRow key={booking.id}>
                      <TableCell className="font-mono text-xs">{booking.referenceNumber}</TableCell>
                      <TableCell>{format(new Date(booking.createdAt), "dd.MM.yyyy")}</TableCell>
                      <TableCell className="font-medium">{booking.childName}</TableCell>
                      <TableCell>{booking.gradeYear}</TableCell>
                      <TableCell>{booking.parentName}</TableCell>
                      <TableCell>{tariffZoneMap[booking.tariffZone]}</TableCell>
                      <TableCell>
                        <span className="truncate max-w-[150px] inline-block" title={bookingTypeMap[booking.bookingType]}>
                          {bookingTypeMap[booking.bookingType]}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusColorMap[booking.status]}>
                          {statusMap[booking.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/admin/bookings/${booking.id}`}>
                          <Button variant="ghost" size="sm">Details</Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}