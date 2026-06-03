import { useState, useRef, useEffect } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { useListAdminBookings } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { Upload, CheckCircle2, AlertCircle, Loader2, Route, ClipboardList, BookOpen, Search, X, ChevronRight, ChevronDown } from "lucide-react";

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

const bookingTypeMap: Record<string, string> = {
  full_year: "Gesamtes Schuljahr 2026/27",
  first_half: "1. Schulhalbjahr 2026/27"
};

function fmtPrice(cents: number | null | undefined): string {
  if (cents == null) return "–";
  return (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

type ImportResult = {
  imported: number;
  skipped: number;
  total: number;
  errors: string[];
};

const COL_WIDTHS = [100, 88, 170, 95, 150, 90, 165, 140, 82, 70];

type RouteCalcResult = { processed: number; failed: number; skipped: number; errors: string[] };

export default function AdminBookingsList() {
  const [view, setView] = useState<"all" | "waitlisted">("all");
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>("all");
  const [tariffZone, setTariffZone] = useState<string>("all");
  const [gradeYear, setGradeYear] = useState<string>("all");
  const [bookingType, setBookingType] = useState<string>("all");
  const [searchInput, setSearchInput] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [pageSize, setPageSize] = useState<number>(30);
  const [collapsedBookings, setCollapsedBookings] = useState<Set<number>>(new Set());

  function toggleSiblings(id: number) {
    setCollapsedBookings((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [routeCalcOpen, setRouteCalcOpen] = useState(false);
  const [routeCalcRunning, setRouteCalcRunning] = useState(false);
  const [routeCalcResult, setRouteCalcResult] = useState<RouteCalcResult | null>(null);
  const [routeCalcError, setRouteCalcError] = useState<string | null>(null);


  const queryClient = useQueryClient();

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const queryParams = {
    page,
    limit: pageSize,
    ...(view === "waitlisted" ? { status: "waitlisted" } : status !== "all" ? { status } : {}),
    ...(tariffZone !== "all" ? { tariffZone } : {}),
    ...(gradeYear !== "all" ? { gradeYear } : {}),
    ...(bookingType !== "all" ? { bookingType } : {}),
    ...(search.trim() ? { search: search.trim() } : {}),
  };

  const { data, isLoading } = useListAdminBookings(queryParams);
  const { data: waitlistCount } = useListAdminBookings({ page: 1, limit: 1, status: "waitlisted" });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    setImportResult(null);
    setImportError(null);
  }

  async function handleImport() {
    if (!selectedFile) return;
    setImporting(true);
    setImportError(null);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const res = await fetch("/api/admin/import", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unbekannter Fehler" }));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      const result: ImportResult = await res.json();
      setImportResult(result);
      // Refresh bookings list
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bookings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
    } catch (err: any) {
      setImportError(err.message ?? "Import fehlgeschlagen");
    } finally {
      setImporting(false);
    }
  }

  function handleOpenImport() {
    setSelectedFile(null);
    setImportResult(null);
    setImportError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setImportOpen(true);
  }

  function handleCloseImport() {
    setImportOpen(false);
  }

  function handleOpenRouteCalc() {
    setRouteCalcResult(null);
    setRouteCalcError(null);
    setRouteCalcOpen(true);
  }

  async function handleCalculateRoutes() {
    setRouteCalcRunning(true);
    setRouteCalcError(null);
    setRouteCalcResult(null);
    try {
      const res = await fetch("/api/admin/bookings/calculate-routes", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unbekannter Fehler" }));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const result: RouteCalcResult = await res.json();
      setRouteCalcResult(result);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bookings"] });
    } catch (err: any) {
      setRouteCalcError(err.message ?? "Berechnung fehlgeschlagen");
    } finally {
      setRouteCalcRunning(false);
    }
  }

  function handleViewChange(v: "all" | "waitlisted") {
    setView(v);
    setPage(1);
    if (v === "waitlisted") setStatus("all");
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-serif font-semibold text-primary">
              {view === "waitlisted" ? "Warteliste" : "Alle Buchungen"}
            </h1>
            {/* Tab Switcher */}
            <div className="flex rounded-lg border border-border overflow-hidden text-sm">
              <button
                onClick={() => handleViewChange("all")}
                className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${
                  view === "all"
                    ? "bg-primary text-primary-foreground font-medium"
                    : "bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                Buchungen
              </button>
              <button
                onClick={() => handleViewChange("waitlisted")}
                className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors border-l border-border ${
                  view === "waitlisted"
                    ? "bg-orange-500 text-white font-medium"
                    : "bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                <ClipboardList className="w-3.5 h-3.5" />
                Warteliste
                {(waitlistCount?.total ?? 0) > 0 && (
                  <span className={`ml-0.5 rounded-full px-1.5 py-0 text-[11px] font-bold ${
                    view === "waitlisted" ? "bg-white text-orange-600" : "bg-orange-100 text-orange-700"
                  }`}>
                    {waitlistCount!.total}
                  </span>
                )}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" onClick={handleOpenImport}>
              <Upload className="w-4 h-4 mr-2" />
              Excel importieren
            </Button>
            <Button variant="outline" onClick={() => window.open("/api/admin/bookings/export?format=xlsx", "_blank")}>
              Excel Export
            </Button>
            <Button variant="outline" onClick={() => window.open("/api/admin/bookings/export", "_blank")}>
              CSV Export
            </Button>
            <Button variant="outline" onClick={handleOpenRouteCalc}>
              <Route className="w-4 h-4 mr-2" />
              Routen berechnen
            </Button>
          </div>
        </div>

        <Card>
          {view === "waitlisted" && (
            <div className="flex items-center gap-2.5 px-5 py-3 bg-orange-50 border-b border-orange-200 text-orange-800 text-sm">
              <ClipboardList className="w-4 h-4 shrink-0" />
              <span>Nur Kinder auf der <strong>Warteliste</strong> werden angezeigt. Status ändern Sie in der Buchungsdetailseite.</span>
            </div>
          )}
          <CardHeader className="flex flex-col gap-3 py-4 bg-muted/50 border-b">
            {/* Row 1: Search */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Suche nach Name, Ref, Elternteil, Ort …"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-8 bg-background h-9"
                />
                {searchInput && (
                  <button
                    onClick={() => setSearchInput("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
            {/* Row 2: Dropdowns */}
            <div className="flex items-center gap-3 flex-wrap">
              {view !== "waitlisted" && (
                <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
                  <SelectTrigger className="w-[170px] bg-background h-9">
                    <SelectValue placeholder="Alle Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Status</SelectItem>
                    <SelectItem value="received">Eingegangen</SelectItem>
                    <SelectItem value="reviewed">Geprüft</SelectItem>
                    <SelectItem value="confirmed">Bestätigt</SelectItem>
                    <SelectItem value="query_open">Rückfrage offen</SelectItem>
                    <SelectItem value="waitlisted">Warteliste</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <Select value={tariffZone} onValueChange={(v) => { setTariffZone(v); setPage(1); }}>
                <SelectTrigger className="w-[150px] bg-background h-9">
                  <SelectValue placeholder="Alle Zonen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Zonen</SelectItem>
                  <SelectItem value="zone1">Tarifzone 1</SelectItem>
                  <SelectItem value="zone2">Tarifzone 2</SelectItem>
                  <SelectItem value="zone3">Tarifzone 3</SelectItem>
                </SelectContent>
              </Select>
              <Select value={bookingType} onValueChange={(v) => { setBookingType(v); setPage(1); }}>
                <SelectTrigger className="w-[220px] bg-background h-9">
                  <SelectValue placeholder="Alle Buchungsarten" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Buchungsarten</SelectItem>
                  <SelectItem value="full_year">Gesamtes Schuljahr 2026/27</SelectItem>
                  <SelectItem value="first_half">Erstes Halbjahr 2026/27</SelectItem>
                </SelectContent>
              </Select>
              <Select value={gradeYear} onValueChange={(v) => { setGradeYear(v); setPage(1); }}>
                <SelectTrigger className="w-[150px] bg-background h-9">
                  <SelectValue placeholder="Alle Klassen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Klassen</SelectItem>
                  {["Jahrgang 1","Jahrgang 2","Jahrgang 3","Jahrgang 4","Jahrgang 5","Jahrgang 6","Jahrgang 7","Jahrgang 8","Jahrgang 9","Jahrgang 10","E-Jahrgang","Q1-Jahrgang","Q2-Jahrgang","MYP3","MYP4","MYP5","DP1","DP2"].map(g => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
                <SelectTrigger className="w-[110px] bg-background h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 / Seite</SelectItem>
                  <SelectItem value="30">30 / Seite</SelectItem>
                  <SelectItem value="50">50 / Seite</SelectItem>
                  <SelectItem value="100">100 / Seite</SelectItem>
                </SelectContent>
              </Select>
              {(search || status !== "all" || tariffZone !== "all" || bookingType !== "all" || gradeYear !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 text-muted-foreground"
                  onClick={() => {
                    setSearchInput(""); setSearch(""); setStatus("all");
                    setTariffZone("all"); setBookingType("all"); setGradeYear("all"); setPage(1);
                  }}
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Filter zurücksetzen
                </Button>
              )}
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
              <div>
                <Table style={{ tableLayout: "fixed", width: "100%" }}>
                  <colgroup>
                    {COL_WIDTHS.map((w, i) => <col key={i} style={{ width: w }} />)}
                  </colgroup>
                  <TableHeader>
                    <TableRow>
                      {(["Ref","Datum","Kind","Klasse","Eltern","Zone","Typ","Status","Preis","Aktion"] as const).map((label, i) => (
                        <TableHead key={i} className="overflow-hidden whitespace-nowrap" style={{ width: COL_WIDTHS[i] }}>
                          <span className={i >= 8 ? "block text-right" : "block truncate"}>{label}</span>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.bookings.flatMap((booking) => {
                      const isWaitlisted = booking.status === "waitlisted";
                      const hasWaitlistedSibling = (booking.siblings ?? []).some((s) => (s as any).status === "waitlisted");
                      const anyWaitlisted = isWaitlisted || hasWaitlistedSibling;
                      // In Warteliste-Tab: only show rows that are actually waitlisted
                      const showMain = view !== "waitlisted" || isWaitlisted;
                      const visibleSiblings = view === "waitlisted"
                        ? (booking.siblings ?? []).filter((s) => (s as any).status === "waitlisted")
                        : (booking.siblings ?? []);
                      if (!showMain && visibleSiblings.length === 0) return [];
                      const hasSiblings = visibleSiblings.length > 0;
                      const isCollapsed = collapsedBookings.has(booking.id);
                      return [
                      ...(showMain ? [<TableRow key={booking.id} className={anyWaitlisted ? "bg-orange-50/70 hover:bg-orange-50 border-l-4 border-l-orange-400" : undefined}>
                        <TableCell className="font-mono text-xs truncate">{booking.referenceNumber}</TableCell>
                        <TableCell className="truncate">{format(new Date(booking.createdAt), "dd.MM.yyyy")}</TableCell>
                        <TableCell className="font-medium truncate">
                          <div className="flex items-center gap-1 min-w-0">
                            {hasSiblings ? (
                              <button
                                type="button"
                                onClick={() => toggleSiblings(booking.id)}
                                className="shrink-0 flex items-center gap-0.5 rounded px-0.5 py-0.5 text-blue-600 hover:bg-blue-100 transition-colors cursor-pointer"
                                title={isCollapsed ? `${visibleSiblings.length} Geschwister einblenden` : "Geschwister ausblenden"}
                              >
                                {isCollapsed
                                  ? <ChevronRight className="w-4 h-4" />
                                  : <ChevronDown className="w-4 h-4" />}
                                <span className="text-[10px] font-bold leading-none">+{visibleSiblings.length}</span>
                              </button>
                            ) : null}
                            {anyWaitlisted && <ClipboardList className="shrink-0 w-3 h-3 text-orange-500" />}
                            <span className="truncate">{booking.childName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="truncate">{booking.gradeYear}</TableCell>
                        <TableCell className="truncate">{booking.parentName}</TableCell>
                        <TableCell className="truncate">{tariffZoneMap[booking.tariffZone]}</TableCell>
                        <TableCell className="truncate" title={bookingTypeMap[booking.bookingType]}>
                          {bookingTypeMap[booking.bookingType]}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusColorMap[booking.status]}>
                            {statusMap[booking.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {fmtPrice(booking.priceCents)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Link href={`/admin/bookings/${booking.id}`}>
                            <Button variant="ghost" size="sm">Details</Button>
                          </Link>
                        </TableCell>
                      </TableRow>] : []),
                      ...(!isCollapsed ? visibleSiblings : []).map((sibling) => {
                        const sibWaitlisted = (sibling as any).status === "waitlisted";
                        const sibHighlight = sibWaitlisted || isWaitlisted;
                        return (
                        <TableRow key={`sib-${sibling.id}`} className={sibHighlight ? "bg-orange-50/40 hover:bg-orange-50 border-l-4 border-l-orange-300" : "bg-blue-50/60 hover:bg-blue-50"}>
                          <TableCell className="font-mono text-xs truncate text-muted-foreground pl-6">{(sibling as any).referenceNumber || `↳ ${booking.referenceNumber}`}</TableCell>
                          <TableCell className="truncate text-muted-foreground">{format(new Date(booking.createdAt), "dd.MM.yyyy")}</TableCell>
                          <TableCell className="font-medium truncate">
                            <span className={`mr-1.5 inline-flex items-center rounded-sm border px-1 py-0 text-[10px] font-semibold ${sibHighlight ? "border-orange-300 bg-orange-100 text-orange-700" : "border-blue-300 bg-blue-100 text-blue-700"}`}>Geschwister</span>
                            {sibling.childName}
                          </TableCell>
                          <TableCell className="truncate">{sibling.gradeYear}</TableCell>
                          <TableCell className="truncate text-muted-foreground">{booking.parentName}</TableCell>
                          <TableCell className="truncate text-muted-foreground">{tariffZoneMap[booking.tariffZone]}</TableCell>
                          <TableCell className="truncate text-muted-foreground" title={bookingTypeMap[booking.bookingType]}>
                            {bookingTypeMap[booking.bookingType]}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={statusColorMap[(sibling as any).status ?? booking.status]}>
                              {statusMap[(sibling as any).status ?? booking.status]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {fmtPrice(sibling.priceCents)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Link href={`/admin/bookings/${booking.id}`}>
                              <Button variant="ghost" size="sm">Details</Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                        );
                      }),
                    ];})}

                  </TableBody>
                  {data && data.totalPriceCents > 0 && (
                    <tfoot>
                      <tr className="border-t-2 border-border bg-muted/40">
                        <td colSpan={8} className="px-4 py-3 text-sm font-semibold text-right">
                          Gesamtsumme ({data.total} Buchung{data.total !== 1 ? "en" : ""})
                        </td>
                        <td className="px-4 py-3 text-right font-bold tabular-nums text-primary">
                          {(data.totalPriceCents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  )}
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Import Dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Excel-Liste importieren</DialogTitle>
            <DialogDescription>
              Wählen Sie eine Excel-Datei (.xlsx) mit den Buchungsdaten aus.
              Bestehende Buchungen mit gleicher Schüler-E-Mail-Kombination werden übersprungen.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div
              className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              {selectedFile ? (
                <p className="text-sm font-medium text-primary">{selectedFile.name}</p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Klicken zum Auswählen oder Datei hierher ziehen
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">.xlsx Dateien</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            <div className="text-xs text-muted-foreground bg-muted/50 rounded p-3 space-y-1">
              <p className="font-medium">Unterstützte Formate:</p>
              <p><span className="font-medium">Neues Format (18 Spalten):</span> Referenznummer · Typ · Name Kind · Straße · PLZ · Wohnort · Schülernummer · Jahrgang · Name Elternteil · E-Mail · Telefon · Tarifzone · Buchungsart · Hinfahrt · Rückfahrt · Status · Notizen · Eingegangen am</p>
              <p className="mt-1"><span className="font-medium">Altes Format (10 Spalten):</span> Name Kind · Schülernummer · Jahrgang · Straße · PLZ · Ort · Name Elternteil · E-Mail · Telefon · Tarifzone — Geschwister werden automatisch anhand gleicher E-Mail-Adresse erkannt.</p>
              <p className="mt-1 text-muted-foreground">Tipp: Verwenden Sie den Excel-Export als Vorlage für das neue Format.</p>
            </div>

            {importError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{importError}</AlertDescription>
              </Alert>
            )}

            {importResult && (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  <span className="font-medium">{importResult.imported} Buchungen importiert</span>
                  {importResult.skipped > 0 && `, ${importResult.skipped} übersprungen`}
                  {importResult.errors.length > 0 && (
                    <ul className="mt-1 text-xs list-disc list-inside">
                      {importResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleCloseImport}>
              {importResult ? "Schließen" : "Abbrechen"}
            </Button>
            {!importResult && (
              <Button
                onClick={handleImport}
                disabled={!selectedFile || importing}
              >
                {importing ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Importiere…</>
                ) : (
                  <><Upload className="w-4 h-4 mr-2" />Importieren</>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Route Calculation Dialog */}
      <Dialog open={routeCalcOpen} onOpenChange={setRouteCalcOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Fahrtzeiten berechnen</DialogTitle>
            <DialogDescription>
              Berechnet Entfernung und Fahrzeit (Auto) vom Wohnort jedes Kindes zur Stiftung Louisenlund für alle Buchungen ohne vorhandene Routendaten. Die Berechnung kann bei vielen Buchungen mehrere Minuten dauern (Nominatim-Limit: 1 Anfrage/Sek.).
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-3">
            {routeCalcError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{routeCalcError}</AlertDescription>
              </Alert>
            )}

            {routeCalcRunning && (
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Berechne Fahrtzeiten… bitte warten.
              </div>
            )}

            {routeCalcResult && (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  <span className="font-medium">{routeCalcResult.processed} Buchungen berechnet</span>
                  {routeCalcResult.skipped > 0 && `, ${routeCalcResult.skipped} übersprungen (bereits vorhanden)`}
                  {routeCalcResult.failed > 0 && `, ${routeCalcResult.failed} fehlgeschlagen`}
                  {routeCalcResult.errors.length > 0 && (
                    <ul className="mt-1 text-xs list-disc list-inside">
                      {routeCalcResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRouteCalcOpen(false)}>
              {routeCalcResult ? "Schließen" : "Abbrechen"}
            </Button>
            {!routeCalcResult && (
              <Button onClick={handleCalculateRoutes} disabled={routeCalcRunning}>
                {routeCalcRunning ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Berechne…</>
                ) : (
                  <><Route className="w-4 h-4 mr-2" />Jetzt berechnen</>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
