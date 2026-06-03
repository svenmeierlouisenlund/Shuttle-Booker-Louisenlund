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
import { useState, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ChevronLeft, Save, Trash2, Pencil, X, MapPin, Navigation } from "lucide-react";
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
  query_open: "Rückfrage offen",
  waitlisted: "Warteliste",
};

const statusColorMap: Record<string, string> = {
  received: "bg-blue-100 text-blue-800 border-blue-200",
  reviewed: "bg-amber-100 text-amber-800 border-amber-200",
  confirmed: "bg-green-100 text-green-800 border-green-200",
  query_open: "bg-red-100 text-red-800 border-red-200",
  waitlisted: "bg-orange-100 text-orange-800 border-orange-200",
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
  "Jahrgang 6","Jahrgang 7","Jahrgang 8","Jahrgang 9","Jahrgang 10",
  "E-Jahrgang","Q1-Jahrgang","Q2-Jahrgang","MYP3","MYP4","MYP5","DP1","DP2"
];

function fmtPrice(cents: number | null | undefined): string {
  if (cents == null) return "–";
  return (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const GRADE_RANKS_ADMIN: Record<string, number> = {
  "Jahrgang 1": 1, "Jahrgang 2": 2, "Jahrgang 3": 3, "Jahrgang 4": 4,
  "Jahrgang 5": 5, "Jahrgang 6": 6, "Jahrgang 7": 7, "Jahrgang 8": 8,
  "MYP3": 8, "Jahrgang 9": 9, "MYP4": 9, "Jahrgang 10": 10,
  "MYP5": 10, "E-Jahrgang": 11, "DP1": 11, "Q1-Jahrgang": 12,
  "DP2": 12, "Q2-Jahrgang": 13,
};
function gradeRankAdmin(grade: string): number { return GRADE_RANKS_ADMIN[grade] ?? 0; }

/** Returns full-payer flags: [mainIsFullPayer, ...siblingIsFullPayer] */
function computeFullPayers(mainGrade: string, siblingGrades: string[]): boolean[] {
  const all = [mainGrade, ...siblingGrades];
  const maxRank = Math.max(...all.map(gradeRankAdmin));
  const flags: boolean[] = [];
  let fpFound = false;
  for (const grade of all) {
    const isFP = !fpFound && gradeRankAdmin(grade) === maxRank;
    if (isFP) fpFound = true;
    flags.push(isFP);
  }
  return flags;
}

interface PricingConfigFlat {
  fullYearBothZone1: number; fullYearBothZone2: number; fullYearBothZone3: number;
  fullYearOneWayZone1: number; fullYearOneWayZone2: number; fullYearOneWayZone3: number;
  firstHalfBothZone1: number; firstHalfBothZone2: number; firstHalfBothZone3: number;
  firstHalfOneWayZone1: number; firstHalfOneWayZone2: number; firstHalfOneWayZone3: number;
}

function calcLivePrice(cfg: PricingConfigFlat, zone: string, bType: string, out: string, ret: string): number {
  const both = out !== "none" && ret !== "none";
  const fy = bType === "full_year";
  if (fy && both)  return zone === "zone1" ? cfg.fullYearBothZone1  : zone === "zone2" ? cfg.fullYearBothZone2  : cfg.fullYearBothZone3;
  if (fy && !both) return zone === "zone1" ? cfg.fullYearOneWayZone1 : zone === "zone2" ? cfg.fullYearOneWayZone2 : cfg.fullYearOneWayZone3;
  if (!fy && both) return zone === "zone1" ? cfg.firstHalfBothZone1  : zone === "zone2" ? cfg.firstHalfBothZone2  : cfg.firstHalfBothZone3;
  return zone === "zone1" ? cfg.firstHalfOneWayZone1 : zone === "zone2" ? cfg.firstHalfOneWayZone2 : cfg.firstHalfOneWayZone3;
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
  pickupAddress: string;
  pickupPostalCode: string;
  pickupCity: string;
  pickupTariffZone: string;
}

function StatusBadge({ status }: { status: string }) {
  const label = statusMap[status] ?? status;
  const color = statusColorMap[status] ?? "bg-gray-100 text-gray-800 border-gray-200";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${color}`}>
      {label}
    </span>
  );
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
  const [editSiblings, setEditSiblings] = useState<Record<number, { outboundRoute: string; returnRoute: string; studentNumber: string; status: string }>>({});
  const [editFields, setEditFields] = useState<EditFields>({
    childName: "", studentNumber: "", gradeYear: "", childAddress: "",
    childPostalCode: "", childCity: "",
    parentName: "", parentEmail: "", parentPhone: "",
    tariffZone: "", bookingType: "", outboundRoute: "", returnRoute: "",
    pickupAddress: "", pickupPostalCode: "", pickupCity: "", pickupTariffZone: "",
  });
  const [pricingConfig, setPricingConfig] = useState<PricingConfigFlat | null>(null);

  useEffect(() => {
    fetch("/api/admin/pricing", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then((d: any) => {
        if (!d) return;
        setPricingConfig({
          fullYearBothZone1: d.fullYear.both.zone1,    fullYearBothZone2: d.fullYear.both.zone2,    fullYearBothZone3: d.fullYear.both.zone3,
          fullYearOneWayZone1: d.fullYear.oneWay.zone1, fullYearOneWayZone2: d.fullYear.oneWay.zone2, fullYearOneWayZone3: d.fullYear.oneWay.zone3,
          firstHalfBothZone1: d.firstHalf.both.zone1,  firstHalfBothZone2: d.firstHalf.both.zone2,  firstHalfBothZone3: d.firstHalf.both.zone3,
          firstHalfOneWayZone1: d.firstHalf.oneWay.zone1, firstHalfOneWayZone2: d.firstHalf.oneWay.zone2, firstHalfOneWayZone3: d.firstHalf.oneWay.zone3,
        });
      })
      .catch(() => {});
  }, []);

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
        pickupAddress: (booking as any).pickupAddress || "",
        pickupPostalCode: (booking as any).pickupPostalCode || "",
        pickupCity: (booking as any).pickupCity || "",
        pickupTariffZone: (booking as any).pickupTariffZone || "",
      });
      const sibMap: Record<number, { outboundRoute: string; returnRoute: string; studentNumber: string; status: string }> = {};
      for (const s of booking.siblings ?? []) {
        sibMap[s.id] = { outboundRoute: s.outboundRoute, returnRoute: s.returnRoute, studentNumber: s.studentNumber || "", status: (s as any).status || "received" };
      }
      setEditSiblings(sibMap);
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
        pickupAddress: (booking as any).pickupAddress || "",
        pickupPostalCode: (booking as any).pickupPostalCode || "",
        pickupCity: (booking as any).pickupCity || "",
        pickupTariffZone: (booking as any).pickupTariffZone || "",
      });
      const sibMap: Record<number, { outboundRoute: string; returnRoute: string; studentNumber: string; status: string }> = {};
      for (const s of booking.siblings ?? []) {
        sibMap[s.id] = { outboundRoute: s.outboundRoute, returnRoute: s.returnRoute, studentNumber: s.studentNumber || "", status: (s as any).status || "received" };
      }
      setEditSiblings(sibMap);
    }
    setEditMode(false);
  }

  const liveEditPrices = useMemo(() => {
    if (!editMode || !pricingConfig || !booking) return null;
    const sibs = booking.siblings ?? [];
    const allGrades = [editFields.gradeYear, ...sibs.map(s => s.gradeYear)];
    const maxRank = Math.max(...allGrades.map(gradeRankAdmin));
    let fpFound = false;
    const effZone = (() => {
      const ranks: Record<string, number> = { zone1: 1, zone2: 2, zone3: 3 };
      const ptz = editFields.pickupTariffZone;
      return ptz && ranks[ptz] < (ranks[editFields.tariffZone] ?? 99) ? ptz : editFields.tariffZone;
    })();
    const mainRaw = calcLivePrice(pricingConfig, effZone, editFields.bookingType, editFields.outboundRoute, editFields.returnRoute);
    const mainIsFP = !fpFound && gradeRankAdmin(editFields.gradeYear) === maxRank;
    if (mainIsFP) fpFound = true;
    const mainPrice = mainIsFP ? mainRaw : Math.round(mainRaw * 0.8);
    const sibPrices = sibs.map(sib => {
      if (sib.priceCents == null) return null;
      const editedOut = editSiblings[sib.id]?.outboundRoute ?? sib.outboundRoute;
      const editedRet = editSiblings[sib.id]?.returnRoute ?? sib.returnRoute;
      const sibRaw = calcLivePrice(pricingConfig, effZone, editFields.bookingType, editedOut, editedRet);
      const sibIsFP = !fpFound && gradeRankAdmin(sib.gradeYear) === maxRank;
      if (sibIsFP) fpFound = true;
      return sibIsFP ? sibRaw : Math.round(sibRaw * 0.8);
    });
    return { mainPrice, sibPrices };
  }, [editMode, pricingConfig, editFields, editSiblings, booking]);

  function handleSaveStatus() {
    updateMutation.mutate({ id, data: { status: status as any, adminNotes } }, {
      onSuccess: () => {
        toast({ title: "Gespeichert", description: "Status und Notizen wurden aktualisiert." });
        queryClient.invalidateQueries({ queryKey: getGetAdminBookingQueryKey(id) });
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
        pickupAddress: editFields.pickupAddress || null,
        pickupPostalCode: editFields.pickupPostalCode || null,
        pickupCity: editFields.pickupCity || null,
        pickupTariffZone: (editFields.pickupTariffZone as any) || null,
        siblingUpdates: Object.entries(editSiblings).map(([idStr, v]) => ({
          id: Number(idStr),
          outboundRoute: v.outboundRoute as any,
          returnRoute: v.returnRoute as any,
          studentNumber: v.studentNumber || null,
          status: v.status as any,
        })),
      }
    }, {
      onSuccess: () => {
        toast({ title: "Gespeichert", description: "Buchungsdaten wurden aktualisiert." });
        queryClient.invalidateQueries({ queryKey: getGetAdminBookingQueryKey(id) });
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

                {/* Sammelpunkt */}
                <div className="pt-4 border-t">
                  <div className="flex items-center gap-2 mb-4">
                    <Navigation className="w-4 h-4 text-primary" />
                    <h3 className="font-semibold text-primary">Sammelpunkt</h3>
                    {!editMode && (booking as any).pickupAddress && (
                      <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">Abweichende Abholadresse</span>
                    )}
                  </div>
                  {!editMode ? (
                    (booking as any).pickupAddress ? (
                      <div className="text-sm space-y-1">
                        <p className="font-medium text-gray-800">{(booking as any).pickupAddress}</p>
                        <p className="text-gray-600">{(booking as any).pickupPostalCode} {(booking as any).pickupCity}</p>
                        {(booking as any).pickupTariffZone && (
                          <p className="text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded px-2 py-0.5 inline-block">
                            Günstigere Preiszone: {tariffZoneMap[(booking as any).pickupTariffZone]}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">Kein Sammelpunkt — Schüler wird an der Heimatadresse abgeholt.</p>
                    )
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground">Nur ausfüllen, wenn der Schüler nicht an der Heimatadresse abgeholt wird.</p>
                      <div className="grid grid-cols-2 gap-y-3 gap-x-8">
                        <div className="col-span-2">
                          <FieldRow label="Straße / Sammelpunkt">
                            <Input
                              value={editFields.pickupAddress}
                              onChange={e => setField("pickupAddress")(e.target.value)}
                              placeholder="z.B. Bahnhofstraße 1"
                            />
                          </FieldRow>
                        </div>
                        <FieldRow label="PLZ">
                          <Input
                            value={editFields.pickupPostalCode}
                            onChange={e => setField("pickupPostalCode")(e.target.value)}
                            placeholder="z.B. 24357"
                          />
                        </FieldRow>
                        <FieldRow label="Ort">
                          <Input
                            value={editFields.pickupCity}
                            onChange={e => setField("pickupCity")(e.target.value)}
                            placeholder="z.B. Schleswig"
                          />
                        </FieldRow>
                        <div className="col-span-2">
                          <FieldRow label="Tarifzone des Abholortes (optional — nur wenn günstiger als Wohnort)">
                            <Select
                              value={editFields.pickupTariffZone || "none"}
                              onValueChange={v => setField("pickupTariffZone")(v === "none" ? "" : v)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Keine abweichende Zone" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Keine abweichende Zone</SelectItem>
                                <SelectItem value="zone1">Tarifzone 1 (günstigste)</SelectItem>
                                <SelectItem value="zone2">Tarifzone 2</SelectItem>
                                <SelectItem value="zone3">Tarifzone 3</SelectItem>
                              </SelectContent>
                            </Select>
                            {editFields.pickupTariffZone && editFields.tariffZone && (() => {
                              const ranks: Record<string, number> = { zone1: 1, zone2: 2, zone3: 3 };
                              const cheaper = ranks[editFields.pickupTariffZone] < ranks[editFields.tariffZone];
                              return cheaper
                                ? <p className="text-xs text-green-700 mt-1">✓ Preis wird auf {tariffZoneMap[editFields.pickupTariffZone]} angepasst (inkl. Geschwisterkinder).</p>
                                : <p className="text-xs text-amber-600 mt-1">⚠ Abholort-Zone ist nicht günstiger als Wohnort — keine Preisanpassung.</p>;
                            })()}
                          </FieldRow>
                        </div>
                      </div>
                      {editFields.pickupAddress && (
                        <button
                          type="button"
                          onClick={() => setEditFields(p => ({ ...p, pickupAddress: "", pickupPostalCode: "", pickupCity: "", pickupTariffZone: "" }))}
                          className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                        >
                          <X className="w-3 h-3" />
                          Sammelpunkt entfernen
                        </button>
                      )}
                    </div>
                  )}
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

                {booking.siblings && booking.siblings.length > 0 && (() => {
                  const fpFlags = computeFullPayers(booking.gradeYear, booking.siblings.map(s => s.gradeYear));
                  return (
                  <div className="pt-4 border-t">
                    <h3 className="font-semibold mb-4 text-primary">Geschwisterkinder</h3>
                    <div className="space-y-4">
                      {booking.siblings.map((sibling, idx) => {
                        const livePrice = liveEditPrices?.sibPrices[idx];
                        const displayPrice = editMode && livePrice != null ? livePrice : sibling.priceCents;
                        return (
                        <div key={sibling.id} className={`bg-muted p-4 rounded-md ${((sibling as any).status || "received") === "waitlisted" ? "border border-orange-300" : ""}`}>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium">{idx + 1}. {sibling.childName}</h4>
                            <div className="flex items-center gap-3">
                              {displayPrice != null && (
                                <span className="text-sm font-semibold text-primary tabular-nums">
                                  {fmtPrice(displayPrice)}
                                  <span className="text-xs font-normal text-muted-foreground ml-1">
                                    {fpFlags[idx + 1] ? "(Vollzahler)" : "(–20 %)"}
                                  </span>
                                </span>
                              )}
                              {editMode ? (
                                <Select
                                  value={editSiblings[sibling.id]?.status ?? (sibling as any).status ?? "received"}
                                  onValueChange={v => setEditSiblings(p => ({ ...p, [sibling.id]: { ...p[sibling.id], status: v } }))}
                                >
                                  <SelectTrigger className="h-7 text-xs w-40">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="received">Eingegangen</SelectItem>
                                    <SelectItem value="reviewed">Geprüft</SelectItem>
                                    <SelectItem value="confirmed">Bestätigt</SelectItem>
                                    <SelectItem value="query_open">Rückfrage offen</SelectItem>
                                    <SelectItem value="waitlisted">Warteliste</SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : (
                                <StatusBadge status={(sibling as any).status || "received"} />
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div><span className="text-muted-foreground">Klasse:</span> {sibling.gradeYear}</div>
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground shrink-0">Schülernummer:</span>
                              {editMode ? (
                                <Input
                                  className="h-7 text-xs"
                                  value={editSiblings[sibling.id]?.studentNumber ?? sibling.studentNumber ?? ""}
                                  onChange={e => setEditSiblings(p => ({ ...p, [sibling.id]: { ...p[sibling.id], studentNumber: e.target.value } }))}
                                  placeholder="–"
                                />
                              ) : (
                                <span>{sibling.studentNumber || "–"}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground shrink-0">Hinfahrt:</span>
                              {editMode ? (
                                <Select
                                  value={editSiblings[sibling.id]?.outboundRoute ?? sibling.outboundRoute}
                                  onValueChange={v => setEditSiblings(p => ({ ...p, [sibling.id]: { ...p[sibling.id], outboundRoute: v } }))}
                                >
                                  <SelectTrigger className="h-7 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="zone1">Tarifzone 1</SelectItem>
                                    <SelectItem value="zone2">Tarifzone 2</SelectItem>
                                    <SelectItem value="zone3">Tarifzone 3</SelectItem>
                                    <SelectItem value="none">Keine</SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : (
                                <span>{routeOptionMap[sibling.outboundRoute]}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground shrink-0">Rückfahrt:</span>
                              {editMode ? (
                                <Select
                                  value={editSiblings[sibling.id]?.returnRoute ?? sibling.returnRoute}
                                  onValueChange={v => setEditSiblings(p => ({ ...p, [sibling.id]: { ...p[sibling.id], returnRoute: v } }))}
                                >
                                  <SelectTrigger className="h-7 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="zone1">Tarifzone 1</SelectItem>
                                    <SelectItem value="zone2">Tarifzone 2</SelectItem>
                                    <SelectItem value="zone3">Tarifzone 3</SelectItem>
                                    <SelectItem value="none">Keine</SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : (
                                <span>{routeOptionMap[sibling.returnRoute]}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  </div>
                  );
                })()}
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
            {(() => {
              const sibs = booking.siblings ?? [];
              const live = liveEditPrices;
              const hasAnyPrice = booking.priceCents != null || sibs.some(s => s.priceCents != null);
              if (!hasAnyPrice && live === null) return null;

              const mainPrice = live !== null ? live.mainPrice : booking.priceCents;
              const sibPricesDisplay: (number | null)[] = live !== null
                ? sibs.map((_sib, i) => live.sibPrices[i] ?? null)
                : sibs.map(sib => sib.priceCents ?? null);
              const total = (mainPrice ?? 0) + sibPricesDisplay.reduce<number>((acc, p) => acc + (p ?? 0), 0);

              const displayGrade = live !== null ? editFields.gradeYear : booking.gradeYear;
              const fpFlags = computeFullPayers(displayGrade, sibs.map(s => s.gradeYear));
              const showRoles = sibs.length > 0;
              const displayBookingType = live !== null ? editFields.bookingType : booking.bookingType;
              const displayChildName = live !== null ? editFields.childName : booking.childName;

              return (
                <Card className={live !== null ? "border-amber-200 bg-amber-50/40" : ""}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      Preisübersicht
                      {live !== null && <span className="text-xs font-normal text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">Vorschau</span>}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {displayChildName}
                        {showRoles && <span className="ml-1 text-xs">{fpFlags[0] ? "(Vollzahler)" : "(Geschwister –20 %)"}</span>}
                      </span>
                      <span className="font-medium tabular-nums">{fmtPrice(mainPrice)}</span>
                    </div>
                    {sibs.map((sib, i) => sibPricesDisplay[i] != null && (
                      <div key={sib.id} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          {sib.childName}
                          {showRoles && <span className="ml-1 text-xs">{fpFlags[i + 1] ? "(Vollzahler)" : "(–20 %)"}</span>}
                        </span>
                        <span className="font-medium tabular-nums">{fmtPrice(sibPricesDisplay[i])}</span>
                      </div>
                    ))}
                    <div className="pt-2 border-t flex justify-between">
                      <span className="font-semibold">Gesamt</span>
                      <span className="font-bold text-primary tabular-nums text-base">{fmtPrice(total)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground pt-1">
                      inkl. MwSt. · {bookingTypeMap[displayBookingType]}
                    </p>
                  </CardContent>
                </Card>
              );
            })()}

            {(booking.distanceKm != null || booking.durationMinutes != null) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    Fahrtweg zur Schule
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {booking.distanceKm != null && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Entfernung</span>
                      <span className="font-medium tabular-nums">
                        {booking.distanceKm.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km
                      </span>
                    </div>
                  )}
                  {booking.durationMinutes != null && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Fahrzeit</span>
                      <span className="font-medium tabular-nums">
                        {booking.durationMinutes >= 60
                          ? `${Math.floor(booking.durationMinutes / 60)} h ${booking.durationMinutes % 60} min`
                          : `${booking.durationMinutes} min`}
                      </span>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground pt-1">
                    Fahrzeit via OSRM (Auto) zur Stiftung Louisenlund, Güby
                  </p>
                </CardContent>
              </Card>
            )}

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
                      <SelectItem value="waitlisted">Warteliste</SelectItem>
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
