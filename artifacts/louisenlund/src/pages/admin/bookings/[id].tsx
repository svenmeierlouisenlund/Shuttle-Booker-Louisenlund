import { AdminLayout } from "@/components/admin-layout";
import { useParams, Link, useLocation } from "wouter";
import { useGetAdminBooking, useUpdateAdminBooking, useDeleteAdminBooking, getGetAdminBookingQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ChevronLeft, Save, Trash2, Pencil, X } from "lucide-react";
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

const gradeYearOptions = [
  "Jahrgang 1","Jahrgang 2","Jahrgang 3","Jahrgang 4","Jahrgang 5",
  "Jahrgang 6","Jahrgang 7","Jahrgang 8","Jahrgang 9","MYP5","DP1","DP2"
];

function fmtPrice(cents: number | null | undefined): string {
  if (cents == null) return "–";
  return (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

interface EditFields {
  childName: string;
  studentNumber: string;
  gradeYear: string;
  childAddress: string;
  childPostalCode: string;
  childCity: string;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  tariffZone: string;
  bookingType: string;
  outboundRoute: string;
  returnRoute: string;
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-sm font-medium text-muted-foreground mb-1">{label}</div>
      {children}
    </div>
  );
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
  const [editMode, setEditMode] = useState(false);
  const [editFields, setEditFields] = useState<EditFields>({
    childName: "", studentNumber: "", gradeYear: "", childAddress: "",
    childPostalCode: "", childCity: "",
    parentName: "", parentEmail: "", parentPhone: "",
    tariffZone: "", bookingType: "", outboundRoute: "", returnRoute: "",
  });

  useEffect(() => {
    if (booking) {
      setStatus(booking.status);
      setAdminNotes(booking.adminNotes || "");
      setEditFields({
        childName: booking.childName,
        studentNumber: booking.studentNumber || "",
        gradeYear: booking.gradeYear,
        childAddress: booking.childAddress,
        childPostalCode: booking.childPostalCode || "",
        childCity: booking.childCity || "",
        parentName: booking.parentName,
        parentEmail: booking.parentEmail,
        parentPhone: booking.parentPhone || "",
        tariffZone: booking.tariffZone,
        bookingType: booking.bookingType,
        outboundRoute: booking.outboundRoute,
        returnRoute: booking.returnRoute,
      });
    }
  }, [booking]);

  function handleCancelEdit() {
    if (booking) {
      setEditFields({
        childName: booking.childName,
        studentNumber: booking.studentNumber || "",
        gradeYear: booking.gradeYear,
        childAddress: booking.childAddress,
        childPostalCode: booking.childPostalCode || "",
        childCity: booking.childCity || "",
        parentName: booking.parentName,
        parentEmail: booking.parentEmail,
        parentPhone: booking.parentPhone || "",
        tariffZone: booking.tariffZone,
        bookingType: booking.bookingType,
        outboundRoute: booking.outboundRoute,
        returnRoute: booking.returnRoute,
      });
    }
    setEditMode(false);
  }

  function handleSaveStatus() {
    updateMutation.mutate({ id, data: { status: status as any, adminNotes } }, {
      onSuccess: (data) => {
        toast({ title: "Gespeichert", description: "Status und Notizen wurden aktualisiert." });
        queryClient.setQueryData(getGetAdminBookingQueryKey(id), data);
      },
      onError: () => {
        toast({ title: "Fehler", description: "Fehler beim Speichern.", variant: "destructive" });
      }
    });
  }

  function handleSaveBookingData() {
    updateMutation.mutate({
      id,
      data: {
        childName: editFields.childName,
        studentNumber: editFields.studentNumber || null,
        gradeYear: editFields.gradeYear,
        childAddress: editFields.childAddress,
        childPostalCode: editFields.childPostalCode,
        childCity: editFields.childCity,
        parentName: editFields.parentName,
        parentEmail: editFields.parentEmail,
        parentPhone: editFields.parentPhone || null,
        tariffZone: editFields.tariffZone as any,
        bookingType: editFields.bookingType as any,
        outboundRoute: editFields.outboundRoute as any,
        returnRoute: editFields.returnRoute as any,
      }
    }, {
      onSuccess: (data) => {
        toast({ title: "Gespeichert", description: "Buchungsdaten wurden aktualisiert." });
        queryClient.setQueryData(getGetAdminBookingQueryKey(id), data);
        setEditMode(false);
      },
      onError: () => {
        toast({ title: "Fehler", description: "Fehler beim Speichern.", variant: "destructive" });
      }
    });
  }

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

  const setField = (k: keyof EditFields) => (v: string) =>
    setEditFields(prev => ({ ...prev, [k]: v }));

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
          <div className="ml-auto flex items-center gap-2">
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

            {/* Buchungsdaten */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Buchungsdaten</CardTitle>
                {!editMode ? (
                  <Button variant="outline" size="sm" onClick={() => setEditMode(true)}>
                    <Pencil className="w-4 h-4 mr-2" />
                    Bearbeiten
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleCancelEdit}>
                      <X className="w-4 h-4 mr-2" />
                      Abbrechen
                    </Button>
                    <Button size="sm" onClick={handleSaveBookingData} disabled={updateMutation.isPending}>
                      <Save className="w-4 h-4 mr-2" />
                      Speichern
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                  <FieldRow label="Datum">
                    <div>{format(new Date(booking.createdAt), "dd.MM.yyyy HH:mm")}</div>
                  </FieldRow>
                  <FieldRow label="Buchungstyp">
                    {editMode ? (
                      <Select value={editFields.bookingType} onValueChange={setField("bookingType")}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="full_year">Gesamtes Schuljahr 2026/27</SelectItem>
                          <SelectItem value="first_half">1. Schulhalbjahr 2026/27</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <div>{bookingTypeMap[booking.bookingType]}</div>
                    )}
                  </FieldRow>
                  <FieldRow label="Tarifzone">
                    {editMode ? (
                      <Select value={editFields.tariffZone} onValueChange={setField("tariffZone")}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="zone1">Tarifzone 1</SelectItem>
                          <SelectItem value="zone2">Tarifzone 2</SelectItem>
                          <SelectItem value="zone3">Tarifzone 3</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <div>{tariffZoneMap[booking.tariffZone]}</div>
                    )}
                  </FieldRow>
                </div>

                <div className="pt-4 border-t">
                  <h3 className="font-semibold mb-4 text-primary">Kind</h3>
                  <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                    <FieldRow label="Name">
                      {editMode ? (
                        <Input value={editFields.childName} onChange={e => setField("childName")(e.target.value)} />
                      ) : (
                        <div>{booking.childName}</div>
                      )}
                    </FieldRow>
                    <FieldRow label="Klasse">
                      {editMode ? (
                        <Select value={editFields.gradeYear} onValueChange={setField("gradeYear")}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {gradeYearOptions.map(g => (
                              <SelectItem key={g} value={g}>{g}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div>{booking.gradeYear}</div>
                      )}
                    </FieldRow>
                    <FieldRow label="Schülernummer">
                      {editMode ? (
                        <Input value={editFields.studentNumber} onChange={e => setField("studentNumber")(e.target.value)} placeholder="–" />
                      ) : (
                        <div>{booking.studentNumber || "–"}</div>
                      )}
                    </FieldRow>
                    <FieldRow label="Straße">
                      {editMode ? (
                        <Input value={editFields.childAddress} onChange={e => setField("childAddress")(e.target.value)} />
                      ) : (
                        <div>{booking.childAddress}</div>
                      )}
                    </FieldRow>
                    <FieldRow label="PLZ">
                      {editMode ? (
                        <Input value={editFields.childPostalCode} onChange={e => setField("childPostalCode")(e.target.value)} />
                      ) : (
                        <div>{booking.childPostalCode || "–"}</div>
                      )}
                    </FieldRow>
                    <FieldRow label="Wohnort">
                      {editMode ? (
                        <Input value={editFields.childCity} onChange={e => setField("childCity")(e.target.value)} />
                      ) : (
                        <div>{booking.childCity || "–"}</div>
                      )}
                    </FieldRow>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <h3 className="font-semibold mb-4 text-primary">Strecken</h3>
                  <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                    <FieldRow label="Hinfahrt (Morgens)">
                      {editMode ? (
                        <Select value={editFields.outboundRoute} onValueChange={setField("outboundRoute")}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="zone1">Tarifzone 1</SelectItem>
                            <SelectItem value="zone2">Tarifzone 2</SelectItem>
                            <SelectItem value="zone3">Tarifzone 3</SelectItem>
                            <SelectItem value="none">Keine</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <div>{routeOptionMap[booking.outboundRoute]}</div>
                      )}
                    </FieldRow>
                    <FieldRow label="Rückfahrt (Nachmittags)">
                      {editMode ? (
                        <Select value={editFields.returnRoute} onValueChange={setField("returnRoute")}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="zone1">Tarifzone 1</SelectItem>
                            <SelectItem value="zone2">Tarifzone 2</SelectItem>
                            <SelectItem value="zone3">Tarifzone 3</SelectItem>
                            <SelectItem value="none">Keine</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <div>{routeOptionMap[booking.returnRoute]}</div>
                      )}
                    </FieldRow>
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
                            <div><span className="text-muted-foreground">Schülernummer:</span> {sibling.studentNumber || "–"}</div>
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

            {/* Elterndaten */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Elterndaten</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                  <FieldRow label="Name">
                    {editMode ? (
                      <Input value={editFields.parentName} onChange={e => setField("parentName")(e.target.value)} />
                    ) : (
                      <div>{booking.parentName}</div>
                    )}
                  </FieldRow>
                  <FieldRow label="Unterschrift">
                    <div className="font-serif italic">{booking.signatureName}</div>
                  </FieldRow>
                  <FieldRow label="E-Mail">
                    {editMode ? (
                      <Input type="email" value={editFields.parentEmail} onChange={e => setField("parentEmail")(e.target.value)} />
                    ) : (
                      <a
                        href={`mailto:${booking.parentEmail}?subject=Ihre%20Buchung%20${encodeURIComponent(booking.referenceNumber)}%20–%20Regionalshuttle%20Louisenlund`}
                        className="text-primary hover:underline"
                      >
                        {booking.parentEmail}
                      </a>
                    )}
                  </FieldRow>
                  <FieldRow label="Telefon">
                    {editMode ? (
                      <Input value={editFields.parentPhone} onChange={e => setField("parentPhone")(e.target.value)} placeholder="–" />
                    ) : (
                      <div>{booking.parentPhone || "–"}</div>
                    )}
                  </FieldRow>
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
                  onClick={handleSaveStatus}
                  disabled={updateMutation.isPending}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Status speichern
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
