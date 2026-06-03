import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Bus, UserPlus, X, Clock, AlertCircle, Pencil, Check, Users } from "lucide-react";
import { useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Passenger {
  type: "booking" | "sibling";
  id: number;
  bookingId: number;
  childName: string;
  gradeYear: string;
  tariffZone: string;
  outboundRoute: string;
  returnRoute: string;
  referenceNumber: string;
  parentName: string;
  status: string;
}

interface WaitlistedBooking {
  id: number;
  referenceNumber: string;
  childName: string;
  gradeYear: string;
  tariffZone: string;
  outboundRoute: string;
  returnRoute: string;
  parentName: string;
  status: string;
}

interface BusWithAssignments {
  id: number;
  name: string;
  capacity: number;
  notes: string | null;
  assignments: Passenger[];
}

interface BusesResponse {
  buses: BusWithAssignments[];
  waitlisted: WaitlistedBooking[];
  unassigned: Passenger[];
}

// ── API helpers ────────────────────────────────────────────────────────────────

async function fetchBuses(): Promise<BusesResponse> {
  const res = await fetch("/api/admin/buses", { credentials: "include" });
  if (!res.ok) throw new Error("Fehler beim Laden der Busse");
  return res.json();
}

async function assignPassenger(busId: number, type: "booking" | "sibling", id: number): Promise<void> {
  const res = await fetch(`/api/admin/buses/${busId}/assign`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, id }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Fehler beim Zuweisen");
  }
}

async function removePassenger(busId: number, type: "booking" | "sibling", id: number): Promise<void> {
  const segment = type === "booking" ? `booking/${id}` : `sibling/${id}`;
  const res = await fetch(`/api/admin/buses/${busId}/assign/${segment}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Fehler beim Entfernen");
  }
}

async function updateBus(busId: number, data: { name?: string; capacity?: number; notes?: string }): Promise<void> {
  const res = await fetch(`/api/admin/buses/${busId}`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Fehler beim Aktualisieren");
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const zoneLabel: Record<string, string> = { zone1: "Zone 1", zone2: "Zone 2", zone3: "Zone 3", none: "—" };

function routeSummary(p: { outboundRoute: string; returnRoute: string }) {
  const out = zoneLabel[p.outboundRoute] ?? p.outboundRoute;
  const ret = zoneLabel[p.returnRoute] ?? p.returnRoute;
  if (p.outboundRoute === p.returnRoute) return out;
  return `Hin: ${out} / Rück: ${ret}`;
}

// ── Passenger Row ───────────────────────────────────────────────────────────────

function PassengerRow({ passenger, onRemove, removing }: {
  passenger: Passenger;
  onRemove?: () => void;
  removing?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between gap-2 py-2 px-3 rounded border transition-colors ${passenger.type === "sibling" ? "bg-blue-50 border-blue-100 hover:border-blue-200" : "bg-white border-gray-100 hover:border-gray-200"}`}>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium text-gray-900 truncate">{passenger.childName}</p>
          {passenger.type === "sibling" && (
            <Badge variant="secondary" className="text-[10px] h-4 px-1 bg-blue-100 text-blue-700 shrink-0">Geschwister</Badge>
          )}
        </div>
        <p className="text-xs text-gray-500">{passenger.gradeYear} · {routeSummary(passenger)}</p>
        <p className="text-xs text-gray-400">{passenger.referenceNumber}</p>
      </div>
      {onRemove && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          disabled={removing}
          className="shrink-0 h-7 w-7 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
        >
          {removing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
        </Button>
      )}
    </div>
  );
}

// ── Bus Card ────────────────────────────────────────────────────────────────────

function BusCard({ bus, onAssign, onRemove, removingKey, updating }: {
  bus: BusWithAssignments;
  onAssign: () => void;
  onRemove: (passenger: Passenger) => void;
  removingKey: string | null;
  updating: boolean;
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(bus.name);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const renameMutation = useMutation({
    mutationFn: (name: string) => updateBus(bus.id, { name }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-buses"] }); setEditingName(false); },
    onError: (err: Error) => toast({ title: "Fehler", description: err.message, variant: "destructive" }),
  });

  const full = bus.assignments.length >= bus.capacity;
  const pct = Math.min(100, Math.round((bus.assignments.length / bus.capacity) * 100));

  return (
    <Card className={`flex flex-col ${full ? "border-orange-200" : "border-gray-200"}`}>
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between gap-2">
          {editingName ? (
            <div className="flex items-center gap-1 flex-1">
              <Input
                value={nameVal}
                onChange={e => setNameVal(e.target.value)}
                className="h-7 text-sm font-semibold"
                autoFocus
                onKeyDown={e => {
                  if (e.key === "Enter") renameMutation.mutate(nameVal);
                  if (e.key === "Escape") { setNameVal(bus.name); setEditingName(false); }
                }}
              />
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => renameMutation.mutate(nameVal)} disabled={renameMutation.isPending}>
                {renameMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5 text-green-600" />}
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setNameVal(bus.name); setEditingName(false); }}>
                <X className="w-3.5 h-3.5 text-gray-400" />
              </Button>
            </div>
          ) : (
            <CardTitle className="text-sm font-semibold text-[#004289] flex items-center gap-1.5">
              <Bus className="w-4 h-4 shrink-0" />
              {bus.name}
              <button onClick={() => { setNameVal(bus.name); setEditingName(true); }} className="ml-1 text-gray-300 hover:text-gray-500 transition-colors">
                <Pencil className="w-3 h-3" />
              </button>
            </CardTitle>
          )}
          <Badge variant={full ? "destructive" : "secondary"} className="text-xs shrink-0">
            {bus.assignments.length}/{bus.capacity}
          </Badge>
        </div>
        <div className="h-1.5 rounded-full bg-gray-100 mt-2">
          <div className={`h-1.5 rounded-full transition-all ${full ? "bg-orange-500" : "bg-[#004289]"}`} style={{ width: `${pct}%` }} />
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 flex-1 flex flex-col gap-2">
        {bus.assignments.length === 0 ? (
          <p className="text-xs text-gray-400 italic py-1">Keine Schüler zugeordnet</p>
        ) : (
          <div className="space-y-1.5">
            {bus.assignments.map(p => (
              <PassengerRow
                key={`${p.type}-${p.id}`}
                passenger={p}
                onRemove={() => onRemove(p)}
                removing={removingKey === `${p.type}-${p.id}`}
              />
            ))}
          </div>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={onAssign}
          disabled={full || updating}
          className="mt-auto w-full text-xs border-dashed border-gray-300 text-gray-500 hover:border-[#004289] hover:text-[#004289]"
        >
          <UserPlus className="w-3.5 h-3.5 mr-1" />
          Schüler zuordnen
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Assign Dialog ───────────────────────────────────────────────────────────────

function AssignDialog({ bus, unassigned, waitlisted, open, onClose, onAssign, assigningKey }: {
  bus: BusWithAssignments | null;
  unassigned: Passenger[];
  waitlisted: WaitlistedBooking[];
  open: boolean;
  onClose: () => void;
  onAssign: (type: "booking" | "sibling", id: number) => void;
  assigningKey: string | null;
}) {
  const [search, setSearch] = useState("");

  const waitlistedAsPassengers: Passenger[] = waitlisted.map(b => ({
    type: "booking" as const,
    id: b.id,
    bookingId: b.id,
    childName: b.childName,
    gradeYear: b.gradeYear,
    tariffZone: b.tariffZone,
    outboundRoute: b.outboundRoute,
    returnRoute: b.returnRoute,
    referenceNumber: b.referenceNumber,
    parentName: b.parentName,
    status: b.status,
  }));

  const candidates = [...unassigned, ...waitlistedAsPassengers].filter(p =>
    p.childName.toLowerCase().includes(search.toLowerCase()) ||
    p.referenceNumber.toLowerCase().includes(search.toLowerCase()) ||
    p.parentName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Schüler zuordnen — {bus?.name}</DialogTitle>
          <DialogDescription>
            Wählen Sie einen Schüler oder ein Geschwisterkind aus dem Pool.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Input
            placeholder="Suchen nach Name, Referenznummer oder Elternteil…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="text-sm"
            autoFocus
          />
          <div className="max-h-80 overflow-y-auto space-y-1.5 pr-1">
            {candidates.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Keine verfügbaren Schüler</p>
            ) : (
              candidates.map(p => {
                const key = `${p.type}-${p.id}`;
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-2 p-2.5 rounded border border-gray-100 hover:border-[#004289] hover:bg-blue-50 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium text-gray-900">{p.childName}</p>
                        {p.type === "sibling" && (
                          <Badge variant="secondary" className="text-[10px] h-4 px-1 bg-blue-100 text-blue-700">Geschwister</Badge>
                        )}
                        {p.status === "waitlisted" && (
                          <Badge variant="secondary" className="text-[10px] h-4 px-1 bg-amber-100 text-amber-700">Warteliste</Badge>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">{p.gradeYear} · {routeSummary(p)}</p>
                      <p className="text-xs text-gray-400">{p.referenceNumber} · {p.parentName}</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => onAssign(p.type, p.id)}
                      disabled={assigningKey === key}
                      className="shrink-0 bg-[#004289] hover:bg-[#003070] text-xs h-7"
                    >
                      {assigningKey === key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Zuordnen"}
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} size="sm">Schließen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────────

export default function AdminBuses() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [assigningBus, setAssigningBus] = useState<BusWithAssignments | null>(null);
  const [removingKey, setRemovingKey] = useState<string | null>(null);
  const [assigningKey, setAssigningKey] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({ queryKey: ["admin-buses"], queryFn: fetchBuses });

  const assignMutation = useMutation({
    mutationFn: ({ busId, type, id }: { busId: number; type: "booking" | "sibling"; id: number }) =>
      assignPassenger(busId, type, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-buses"] });
      queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
      setAssigningKey(null);
      setAssigningBus(null);
    },
    onError: (err: Error) => {
      toast({ title: "Fehler", description: err.message, variant: "destructive" });
      setAssigningKey(null);
    },
  });

  const removeMutation = useMutation({
    mutationFn: ({ busId, type, id }: { busId: number; type: "booking" | "sibling"; id: number }) =>
      removePassenger(busId, type, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-buses"] });
      queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
      setRemovingKey(null);
    },
    onError: (err: Error) => {
      toast({ title: "Fehler", description: err.message, variant: "destructive" });
      setRemovingKey(null);
    },
  });

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[#004289]" />
        </div>
      </AdminLayout>
    );
  }

  if (error || !data) {
    return (
      <AdminLayout>
        <div className="text-center py-20 text-red-600">Fehler beim Laden der Busse.</div>
      </AdminLayout>
    );
  }

  const totalCapacity = data.buses.reduce((s, b) => s + b.capacity, 0);
  const totalAssigned = data.buses.reduce((s, b) => s + b.assignments.length, 0);
  const totalSiblings = data.buses.reduce((s, b) => s + b.assignments.filter(p => p.type === "sibling").length, 0);

  const handleRemove = (bus: BusWithAssignments, passenger: Passenger) => {
    const key = `${passenger.type}-${passenger.id}`;
    setRemovingKey(key);
    removeMutation.mutate({ busId: bus.id, type: passenger.type, id: passenger.id });
  };

  const handleAssign = (type: "booking" | "sibling", id: number) => {
    if (!assigningBus) return;
    const key = `${type}-${id}`;
    setAssigningKey(key);
    assignMutation.mutate({ busId: assigningBus.id, type, id });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-[#004289]">Busverwaltung</h1>
            <p className="text-gray-500 text-sm mt-1">
              Schüler und Geschwisterkinder manuell den Shuttlebussen zuordnen.
            </p>
          </div>
          <div className="flex gap-3 text-sm">
            <div className="bg-white border border-gray-200 rounded px-3 py-2 text-center">
              <div className="text-lg font-bold text-[#004289]">{totalAssigned}</div>
              <div className="text-xs text-gray-500">Belegt</div>
            </div>
            <div className="bg-white border border-gray-200 rounded px-3 py-2 text-center">
              <div className="text-lg font-bold text-blue-500">{totalSiblings}</div>
              <div className="text-xs text-gray-500">davon Geschwister</div>
            </div>
            <div className="bg-white border border-gray-200 rounded px-3 py-2 text-center">
              <div className="text-lg font-bold text-gray-400">{totalCapacity - totalAssigned}</div>
              <div className="text-xs text-gray-500">Frei</div>
            </div>
            <div className="bg-white border border-gray-200 rounded px-3 py-2 text-center">
              <div className="text-lg font-bold text-amber-600">{data.waitlisted.length}</div>
              <div className="text-xs text-gray-500">Warteliste</div>
            </div>
          </div>
        </div>

        {/* Bus grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {data.buses.map(bus => (
            <BusCard
              key={bus.id}
              bus={bus}
              onAssign={() => setAssigningBus(bus)}
              onRemove={(passenger) => handleRemove(bus, passenger)}
              removingKey={removingKey}
              updating={assignMutation.isPending}
            />
          ))}
        </div>

        {/* Waitlist */}
        {data.waitlisted.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-amber-600" />
              <h2 className="font-semibold text-gray-800">Warteliste ({data.waitlisted.length})</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {data.waitlisted.map(b => (
                <div key={b.id} className="flex items-center justify-between gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{b.childName}</p>
                    <p className="text-xs text-gray-500">{b.gradeYear} · {routeSummary(b)}</p>
                    <p className="text-xs text-gray-400">{b.referenceNumber}</p>
                  </div>
                  <Badge className="shrink-0 bg-amber-100 text-amber-700 border-0 text-xs">Warteliste</Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Unassigned pool */}
        {data.unassigned.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="w-4 h-4 text-gray-400" />
              <h2 className="font-semibold text-gray-800">Nicht zugeordnet ({data.unassigned.length})</h2>
              <span className="text-xs text-gray-400">— Buchungen und Geschwisterkinder ohne Buszuweisung</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {data.unassigned.map(p => (
                <div key={`${p.type}-${p.id}`} className={`flex items-center justify-between gap-2 p-3 rounded-lg border ${p.type === "sibling" ? "bg-blue-50 border-blue-200" : "bg-white border-gray-200"}`}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-gray-900 truncate">{p.childName}</p>
                      {p.type === "sibling" && (
                        <Badge variant="secondary" className="text-[10px] h-4 px-1 bg-blue-100 text-blue-700 shrink-0">Geschwister</Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">{p.gradeYear} · {routeSummary(p)}</p>
                    <p className="text-xs text-gray-400">{p.referenceNumber}</p>
                  </div>
                  {p.type === "sibling" && <Users className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Assign dialog */}
      <AssignDialog
        bus={assigningBus}
        unassigned={data.unassigned}
        waitlisted={data.waitlisted}
        open={assigningBus !== null}
        onClose={() => setAssigningBus(null)}
        onAssign={handleAssign}
        assigningKey={assigningKey}
      />
    </AdminLayout>
  );
}
