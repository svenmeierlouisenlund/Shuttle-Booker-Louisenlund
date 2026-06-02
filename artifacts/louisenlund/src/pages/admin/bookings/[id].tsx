import { AdminLayout } from "@/components/admin-layout";
import { useParams, Link, useLocation } from "wouter";
import { useGetAdminBooking, useUpdateAdminBooking, useDeleteAdminBooking, getGetAdminBookingQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ChevronLeft, Save, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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

const routeOptionMap: Record<string, string> = {
  zone1: "Tarifzone 1",
  zone2: "Tarifzone 2",
  zone3: "Tarifzone 3",
  none: "Keine"
};

const bookingTypeMap: Record<string, string> = {
  full_year: "Gesamtes Schuljahr 2026/27",
  first_half: "1. Schulhalbjahr 2026/27"
};

function fmtPrice(cents: number | null | undefined): string {
  if (cents == null) return "–";
  return (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function AdminBookingDetail() {
  const params = useParams();
  const id = Number(params.id);
  const [, navigate] = useLocation();
  const { data: booking, isLoading } = useGetAdminBooking(id, { query: { enabled: !!id, queryKey: getGetAdminBookingQueryKey(id) } });
  const updateMutation = useUpdateAdminBooking();
  const deleteMutation = useDeleteAdminBooking();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [status, setStatus] = useState<string>("");
  const [adminNotes, setAdminNotes] = useState<string>("");

  useEffect(() => {
    if (booking) {
      setStatus(booking.status);
      setAdminNotes(booking.adminNotes || "");
    }
  }, [booking]);

  const handleSave = () => {
    updateMutation.mutate({ id, data: { status: status as any, adminNotes } }, {
      onSuccess: (data) => {
        toast({ title: "Gespeichert", description: "Die Buchung wurde aktualisiert." });
        queryClient.setQueryData(getGetAdminBookingQueryKey(id), data);
      },
      onError: () => {
        toast({ title: "Fehler", description: "Fehler beim Speichern.", variant: "destructive" });
      }
    });
  };

  const handleDelete = () => {
    deleteMutation.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Buchung gelöscht", description: "Die Buchung wurde endgültig gelöscht." });
        navigate("/admin/bookings");
      },
      onError: () => {
        toast({ title: "Fehler", description: "Fehler beim Löschen.", variant: "destructive" });
      }
    });
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <Skeleton className="h-[600px] w-full" />
      </AdminLayout>
    );
  }

  if (!booking) return null;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/admin/bookings">
            <Button variant="ghost" size="icon">
              <ChevronLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-serif font-semibold text-primary">
            Buchung {booking.referenceNumber}
          </h1>
          <Badge variant="outline" className={statusColorMap[booking.status]}>
            {statusMap[booking.status]}
          </Badge>
          <div className="ml-auto">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Buchung löschen
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Buchung endgültig löschen?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Die Buchung <strong>{booking.referenceNumber}</strong> ({booking.childName}) wird unwiderruflich gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    Endgültig löschen
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Buchungsdaten</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Datum</div>
                    <div>{format(new Date(booking.createdAt), "dd.MM.yyyy HH:mm")}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Buchungstyp</div>
                    <div>{bookingTypeMap[booking.bookingType]}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Tarifzone</div>
                    <div>{tariffZoneMap[booking.tariffZone]}</div>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <h3 className="font-semibold mb-4 text-primary">Kind</h3>
                  <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">Name</div>
                      <div>{booking.childName}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">Klasse</div>
                      <div>{booking.gradeYear}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">Schülernummer</div>
                      <div>{booking.studentNumber || "-"}</div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-sm font-medium text-muted-foreground">Adresse</div>
                      <div>{booking.childAddress}</div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <h3 className="font-semibold mb-4 text-primary">Strecken</h3>
                  <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">Hinfahrt (Morgens)</div>
                      <div>{routeOptionMap[booking.outboundRoute]}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">Rückfahrt (Nachmittags)</div>
                      <div>{routeOptionMap[booking.returnRoute]}</div>
                    </div>
                  </div>
                </div>

                {booking.siblings && booking.siblings.length > 0 && (
                  <div className="pt-4 border-t">
                    <h3 className="font-semibold mb-4 text-primary">Geschwisterkinder</h3>
                    <div className="space-y-4">
                      {booking.siblings.map((sibling, idx) => (
                        <div key={sibling.id} className="bg-muted p-4 rounded-md">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium">{idx + 1}. {sibling.childName}</h4>
                            {sibling.priceCents != null && (
                              <span className="text-sm font-semibold text-primary tabular-nums">
                                {fmtPrice(sibling.priceCents)}
                                <span className="text-xs font-normal text-muted-foreground ml-1">(–20 %)</span>
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div><span className="text-muted-foreground">Klasse:</span> {sibling.gradeYear}</div>
                            <div><span className="text-muted-foreground">Schülernummer:</span> {sibling.studentNumber || "-"}</div>
                            <div><span className="text-muted-foreground">Hinfahrt:</span> {routeOptionMap[sibling.outboundRoute]}</div>
                            <div><span className="text-muted-foreground">Rückfahrt:</span> {routeOptionMap[sibling.returnRoute]}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Elterndaten</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Name</div>
                    <div>{booking.parentName}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Unterschrift</div>
                    <div className="font-serif italic">{booking.signatureName}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">E-Mail</div>
                    <div>{booking.parentEmail}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Telefon</div>
                    <div>{booking.parentPhone || "-"}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            {(booking.priceCents != null || (booking.siblings && booking.siblings.some(s => s.priceCents != null))) && (() => {
              const total = (booking.priceCents ?? 0) + (booking.siblings ?? []).reduce((s, sib) => s + (sib.priceCents ?? 0), 0);
              return (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Preisübersicht</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{booking.childName} (Vollzahler)</span>
                      <span className="font-medium tabular-nums">{fmtPrice(booking.priceCents)}</span>
                    </div>
                    {(booking.siblings ?? []).map((sib) => sib.priceCents != null && (
                      <div key={sib.id} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{sib.childName} <span className="text-xs">(–20 %)</span></span>
                        <span className="font-medium tabular-nums">{fmtPrice(sib.priceCents)}</span>
                      </div>
                    ))}
                    <div className="pt-2 border-t flex justify-between">
                      <span className="font-semibold">Gesamt</span>
                      <span className="font-bold text-primary tabular-nums text-base">{fmtPrice(total)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground pt-1">
                      inkl. MwSt. · {bookingTypeMap[booking.bookingType]}
                    </p>
                  </CardContent>
                </Card>
              );
            })()}

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Bearbeitung</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="received">Eingegangen</SelectItem>
                      <SelectItem value="reviewed">Geprüft</SelectItem>
                      <SelectItem value="confirmed">Bestätigt</SelectItem>
                      <SelectItem value="query_open">Rückfrage offen</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Interne Notizen</label>
                  <Textarea 
                    value={adminNotes} 
                    onChange={e => setAdminNotes(e.target.value)} 
                    placeholder="Notizen zur Bearbeitung..."
                    className="min-h-[150px]"
                  />
                </div>

                <Button 
                  className="w-full" 
                  onClick={handleSave} 
                  disabled={updateMutation.isPending}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Änderungen speichern
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}