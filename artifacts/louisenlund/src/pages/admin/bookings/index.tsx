import { useState, useRef } from "react";
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
import { format } from "date-fns";
import { Upload, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

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

type ImportResult = {
  imported: number;
  skipped: number;
  total: number;
  errors: string[];
};

export default function AdminBookingsList() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>("all");
  const [tariffZone, setTariffZone] = useState<string>("all");

  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const queryClient = useQueryClient();

  const queryParams = {
    page,
    limit: 50,
    ...(status !== "all" ? { status } : {}),
    ...(tariffZone !== "all" ? { tariffZone } : {})
  };

  const { data, isLoading } = useListAdminBookings(queryParams);

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

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="text-2xl font-serif font-semibold text-primary">Alle Buchungen</h1>
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
              <p className="font-medium">Erwartetes Spaltenformat:</p>
              <p>Name des Schülers · Schülernummer · Jahrgang · Straße · PLZ · Ort · Name des Elternteils · E-Mail · Mobilfunk · Tarifzone</p>
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
    </AdminLayout>
  );
}
