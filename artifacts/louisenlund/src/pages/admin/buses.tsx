import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  Loader2,
  Bus,
  X,
  Clock,
  AlertCircle,
  Pencil,
  Check,
  Users,
  GripVertical,
  Phone,
  User,
  ExternalLink,
  Plus,
  Trash2,
} from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";

// ── Destination helper ─────────────────────────────────────────────────────────
const GRADES_HOF = new Set(["Jahrgang 1","Jahrgang 2","Jahrgang 3","Jahrgang 4","Jahrgang 5","Jahrgang 6","Jahrgang 7"]);
function isHof(gradeYear: string): boolean { return GRADES_HOF.has(gradeYear); }
function DestBadge({ gradeYear }: { gradeYear: string }) {
  return isHof(gradeYear)
    ? <span className="inline-flex items-center px-1.5 py-0 rounded text-[10px] font-medium bg-green-100 text-green-700">Hof</span>
    : <span className="inline-flex items-center px-1.5 py-0 rounded text-[10px] font-medium bg-purple-100 text-purple-700">Schloss</span>;
}

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
  driverName: string | null;
  driverPhone: string | null;
  isWaitlistBus: boolean;
  assignments: Passenger[];
}

interface BusesResponse {
  buses: BusWithAssignments[];
  waitlisted: WaitlistedBooking[];
  unassigned: Passenger[];
}

// ── Drag ID helpers ────────────────────────────────────────────────────────────
// Format: "{type}:{id}:{source}"  where source = "pool" | "waitlist" | bus-id

function makeDragId(p: Passenger, source: string) {
  return `${p.type}:${p.id}:${source}`;
}

function parseDragId(id: string): { type: "booking" | "sibling"; passengerId: number; source: string } | null {
  const parts = id.split(":");
  if (parts.length < 3) return null;
  return {
    type: parts[0] as "booking" | "sibling",
    passengerId: Number(parts[1]),
    source: parts.slice(2).join(":"),
  };
}

// ── API helpers ────────────────────────────────────────────────────────────────

async function fetchBuses(): Promise<BusesResponse> {
  const res = await fetch("/api/admin/buses", { credentials: "include" });
  if (!res.ok) throw new Error("Fehler beim Laden der Busse");
  return res.json();
}

async function assignPassenger(busId: number, type: "booking" | "sibling", id: number) {
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

async function removePassenger(busId: number, type: "booking" | "sibling", id: number) {
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

async function updateBus(busId: number, data: { name?: string }) {
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

async function createBus() {
  const res = await fetch("/api/admin/buses", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Fehler beim Erstellen");
  }
  return res.json();
}

async function deleteBus(busId: number) {
  const res = await fetch(`/api/admin/buses/${busId}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Fehler beim Löschen");
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const zoneLabel: Record<string, string> = { zone1: "Zone 1", zone2: "Zone 2", zone3: "Zone 3", none: "—" };

function routeSummary(p: { outboundRoute: string; returnRoute: string }) {
  const out = zoneLabel[p.outboundRoute] ?? p.outboundRoute;
  const ret = zoneLabel[p.returnRoute] ?? p.returnRoute;
  return p.outboundRoute === p.returnRoute ? out : `${out} / ${ret}`;
}

// ── Draggable Passenger Card ────────────────────────────────────────────────────

function DraggablePassenger({
  passenger,
  source,
  onRemove,
  removing,
  compact = false,
}: {
  passenger: Passenger;
  source: string;
  onRemove?: () => void;
  removing?: boolean;
  compact?: boolean;
}) {
  const dragId = makeDragId(passenger, source);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: dragId });

  const style = transform
    ? { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.35 : 1 }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-1.5 rounded border transition-colors select-none
        ${compact ? "py-1.5 px-2" : "py-2 px-3"}
        ${passenger.type === "sibling"
          ? "bg-blue-50 border-blue-100 hover:border-blue-300"
          : "bg-white border-gray-100 hover:border-gray-300"}
        ${isDragging ? "shadow-lg z-50" : ""}
      `}
    >
      {/* Drag handle */}
      <button
        {...listeners}
        {...attributes}
        className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 shrink-0 touch-none"
        tabIndex={-1}
      >
        <GripVertical className="w-3.5 h-3.5" />
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium text-gray-900 truncate">{passenger.childName}</p>
          {passenger.type === "sibling" && (
            <Badge variant="secondary" className="text-[10px] h-4 px-1 bg-blue-100 text-blue-700 shrink-0">
              Geschwister
            </Badge>
          )}
          {passenger.status === "waitlisted" && (
            <Badge variant="secondary" className="text-[10px] h-4 px-1 bg-amber-100 text-amber-700 shrink-0">
              Warteliste
            </Badge>
          )}
        </div>
        <p className="text-xs text-gray-500 truncate flex items-center gap-1 flex-wrap">
          {passenger.gradeYear} · <DestBadge gradeYear={passenger.gradeYear} /> · {routeSummary(passenger)}
        </p>
        {!compact && <p className="text-xs text-gray-400">{passenger.referenceNumber}</p>}
      </div>

      {onRemove && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          disabled={removing}
          className="shrink-0 h-6 w-6 p-0 text-gray-300 hover:text-red-600 hover:bg-red-50"
        >
          {removing ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
        </Button>
      )}
    </div>
  );
}

// ── Passenger ghost for DragOverlay ───────────────────────────────────────────

function PassengerGhost({ passenger }: { passenger: Passenger }) {
  return (
    <div
      className={`flex items-center gap-2 py-2 px-3 rounded border shadow-xl cursor-grabbing
        ${passenger.type === "sibling" ? "bg-blue-50 border-blue-300" : "bg-white border-gray-300"}`}
    >
      <GripVertical className="w-3.5 h-3.5 text-gray-400" />
      <div>
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-semibold text-gray-900">{passenger.childName}</p>
          {passenger.type === "sibling" && (
            <Badge className="text-[10px] h-4 px-1 bg-blue-100 text-blue-700 border-0">Geschwister</Badge>
          )}
        </div>
        <p className="text-xs text-gray-500 flex items-center gap-1">{passenger.gradeYear} · <DestBadge gradeYear={passenger.gradeYear} /> · {routeSummary(passenger)}</p>
      </div>
    </div>
  );
}

// ── Bus Drop Zone ───────────────────────────────────────────────────────────────

function BusDropZone({
  bus,
  children,
  isOver,
  isFull,
}: {
  bus: BusWithAssignments;
  children: React.ReactNode;
  isOver: boolean;
  isFull: boolean;
}) {
  const { setNodeRef } = useDroppable({ id: `bus:${bus.id}` });

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-h-16 rounded transition-all duration-150
        ${isOver && !isFull ? "ring-2 ring-[#004289] ring-offset-1 bg-blue-50/60" : ""}
        ${isOver && isFull ? "ring-2 ring-red-400 ring-offset-1 bg-red-50/60" : ""}
      `}
    >
      {children}
    </div>
  );
}

// ── Bus Card ────────────────────────────────────────────────────────────────────

function BusCard({
  bus,
  overBusId,
  onRemove,
  onDelete,
  removingKey,
}: {
  bus: BusWithAssignments;
  overBusId: number | null;
  onRemove: (passenger: Passenger) => void;
  onDelete: () => void;
  removingKey: string | null;
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(bus.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const renameMutation = useMutation({
    mutationFn: (name: string) => updateBus(bus.id, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-buses"] });
      setEditingName(false);
    },
    onError: (err: Error) => toast({ title: "Fehler", description: err.message, variant: "destructive" }),
  });

  const isOver = overBusId === bus.id;
  const full = bus.assignments.length >= bus.capacity;
  const pct = Math.min(100, Math.round((bus.assignments.length / bus.capacity) * 100));

  return (
    <Card className={`flex flex-col transition-all duration-150 ${full ? "border-orange-200" : "border-gray-200"} ${isOver && !full ? "border-[#004289]" : ""} ${isOver && full ? "border-red-400" : ""}`}>
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
            <CardTitle className="text-sm font-semibold text-[#004289] flex items-center gap-1.5 min-w-0">
              <Bus className="w-4 h-4 shrink-0" />
              <span className="truncate">{bus.name}</span>
              <button
                onClick={() => { setNameVal(bus.name); setEditingName(true); }}
                className="ml-1 text-gray-300 hover:text-gray-500 transition-colors shrink-0"
              >
                <Pencil className="w-3 h-3" />
              </button>
            </CardTitle>
          )}
          <div className="flex items-center gap-1 shrink-0">
            <Badge variant={full ? "destructive" : "secondary"} className="text-xs">
              {bus.assignments.length}/{bus.capacity}
            </Badge>
            {confirmDelete ? (
              <>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-600 hover:bg-red-50" onClick={onDelete} title="Löschen bestätigen">
                  <Check className="w-3 h-3" />
                </Button>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-gray-400 hover:bg-gray-50" onClick={() => setConfirmDelete(false)} title="Abbrechen">
                  <X className="w-3 h-3" />
                </Button>
              </>
            ) : (
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-gray-200 hover:text-red-500 hover:bg-red-50" onClick={() => setConfirmDelete(true)} title="Bus löschen">
                <Trash2 className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>
        <div className="h-1.5 rounded-full bg-gray-100 mt-2">
          <div
            className={`h-1.5 rounded-full transition-all ${full ? "bg-orange-500" : "bg-[#004289]"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {/* Driver info */}
        <div className="mt-2 space-y-0.5">
          {bus.driverName ? (
            <p className="text-xs text-gray-600 flex items-center gap-1.5">
              <User className="w-3 h-3 text-gray-400 shrink-0" />
              {bus.driverName}
            </p>
          ) : (
            <p className="text-xs text-gray-400 italic flex items-center gap-1.5">
              <User className="w-3 h-3 shrink-0" />
              Kein Fahrer hinterlegt
            </p>
          )}
          {bus.driverPhone && (
            <p className="text-xs text-gray-600 flex items-center gap-1.5">
              <Phone className="w-3 h-3 text-gray-400 shrink-0" />
              {bus.driverPhone}
            </p>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 flex-1 flex flex-col">
        <BusDropZone bus={bus} isOver={isOver} isFull={full}>
          {bus.assignments.length === 0 ? (
            <div className={`flex items-center justify-center min-h-16 rounded border-2 border-dashed transition-colors
              ${isOver && !full ? "border-[#004289] bg-blue-50" : "border-gray-200"}
            `}>
              <p className="text-xs text-gray-400 italic">Hierher ziehen</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {bus.assignments.map(p => (
                <DraggablePassenger
                  key={`${p.type}-${p.id}`}
                  passenger={p}
                  source={String(bus.id)}
                  onRemove={() => onRemove(p)}
                  removing={removingKey === `${p.type}-${p.id}`}
                />
              ))}
              {/* Ghost drop target when bus has items */}
              {isOver && !full && (
                <div className="h-8 rounded border-2 border-dashed border-[#004289] bg-blue-50 flex items-center justify-center">
                  <p className="text-xs text-[#004289]">Hier ablegen</p>
                </div>
              )}
              {isOver && full && (
                <div className="h-8 rounded border-2 border-dashed border-red-400 bg-red-50 flex items-center justify-center">
                  <p className="text-xs text-red-500">Bus ist voll</p>
                </div>
              )}
            </div>
          )}
        </BusDropZone>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/admin/buses/${bus.id}`)}
          className="mt-2 w-full text-xs text-[#004289] hover:bg-[#004289]/5 gap-1.5"
        >
          <ExternalLink className="w-3 h-3" />
          Details & Routenplanung
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Unassigned Pool ─────────────────────────────────────────────────────────────

function UnassignedPool({ passengers }: { passengers: Passenger[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: "pool" });

  if (passengers.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <AlertCircle className="w-4 h-4 text-gray-400" />
        <h2 className="font-semibold text-gray-800">Nicht zugeordnet ({passengers.length})</h2>
        <span className="text-xs text-gray-400">— Drag & Drop auf einen Bus zum Zuordnen</span>
      </div>
      <div
        ref={setNodeRef}
        className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 min-h-12 rounded-lg p-2 border-2 border-dashed transition-colors
          ${isOver ? "border-[#004289] bg-blue-50/40" : "border-transparent"}`}
      >
        {passengers.map(p => (
          <DraggablePassenger
            key={`${p.type}-${p.id}`}
            passenger={p}
            source="pool"
          />
        ))}
      </div>
    </div>
  );
}

// ── Waitlist Bus Card ────────────────────────────────────────────────────────────

function WaitlistBusCard({ bus }: { bus: BusWithAssignments }) {
  const [, navigate] = useLocation();

  return (
    <Card className="flex flex-col border-amber-200 bg-amber-50/30 col-span-full sm:col-span-2 lg:col-span-4">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-sm font-semibold text-amber-700 flex items-center gap-1.5">
            <Clock className="w-4 h-4 shrink-0" />
            Warteliste
            <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700 border-0 ml-1">
              {bus.assignments.length} Kind{bus.assignments.length !== 1 ? "er" : ""}
            </Badge>
          </CardTitle>
          <span className="text-xs text-amber-600/70">Status-basiert — Kinder erscheinen automatisch bei Warteliste-Status</span>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {bus.assignments.length === 0 ? (
          <p className="text-xs text-amber-500/70 italic py-3 text-center">Keine Kinder auf der Warteliste</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {bus.assignments.map(p => (
              <div
                key={`${p.type}-${p.id}`}
                className={`flex items-center gap-2 rounded border py-2 px-3 select-none
                  ${p.type === "sibling"
                    ? "bg-blue-50 border-blue-100"
                    : "bg-white border-amber-100"}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-sm font-medium text-gray-900 truncate">{p.childName}</p>
                    {p.type === "sibling" && (
                      <Badge variant="secondary" className="text-[10px] h-4 px-1 bg-blue-100 text-blue-700 shrink-0">
                        Geschwister
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate flex items-center gap-1 flex-wrap">{p.gradeYear} · <DestBadge gradeYear={p.gradeYear} /> · {routeSummary(p)}</p>
                  <p className="text-xs text-gray-400">{p.referenceNumber}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/admin/buses/${bus.id}`)}
          className="mt-3 text-xs text-amber-700 hover:bg-amber-100/50 gap-1.5"
        >
          <ExternalLink className="w-3 h-3" />
          Details & Routenplanung
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────────

export default function AdminBuses() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activePassenger, setActivePassenger] = useState<Passenger | null>(null);
  const [overBusId, setOverBusId] = useState<number | null>(null);
  const [removingKey, setRemovingKey] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-buses"],
    queryFn: fetchBuses,
  });

  const assignMutation = useMutation({
    mutationFn: ({ busId, type, id }: { busId: number; type: "booking" | "sibling"; id: number }) =>
      assignPassenger(busId, type, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-buses"] });
      queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
    },
    onError: (err: Error) => {
      toast({ title: "Fehler beim Zuordnen", description: err.message, variant: "destructive" });
      queryClient.invalidateQueries({ queryKey: ["admin-buses"] });
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

  const createMutation = useMutation({
    mutationFn: createBus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-buses"] });
      toast({ title: "Bus erstellt", description: "Der neue Bus wurde angelegt." });
    },
    onError: (err: Error) => toast({ title: "Fehler", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (busId: number) => deleteBus(busId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-buses"] });
      toast({ title: "Bus gelöscht" });
    },
    onError: (err: Error) => toast({ title: "Fehler beim Löschen", description: err.message, variant: "destructive" }),
  });

  const handleRemove = (bus: BusWithAssignments, passenger: Passenger) => {
    const key = `${passenger.type}-${passenger.id}`;
    setRemovingKey(key);
    removeMutation.mutate({ busId: bus.id, type: passenger.type, id: passenger.id });
  };

  const handleDragStart = (event: DragStartEvent) => {
    if (!data) return;
    const parsed = parseDragId(String(event.active.id));
    if (!parsed) return;

    // Find the actual passenger object
    const { type, passengerId, source } = parsed;

    if (source === "pool" || source === "waitlist") {
      const allPassengers: Passenger[] = [
        ...data.unassigned,
      ];
      const found = allPassengers.find(p => p.type === type && p.id === passengerId);
      setActivePassenger(found ?? null);
    } else {
      // From a bus
      const sourceBusId = Number(source);
      const bus = data.buses.find(b => b.id === sourceBusId);
      const found = bus?.assignments.find(p => p.type === type && p.id === passengerId);
      setActivePassenger(found ?? null);
    }
  };

  const handleDragOver = (event: { over: { id: string | number } | null }) => {
    if (!event.over) { setOverBusId(null); return; }
    const overId = String(event.over.id);
    if (overId.startsWith("bus:")) {
      setOverBusId(Number(overId.replace("bus:", "")));
    } else {
      setOverBusId(null);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActivePassenger(null);
    setOverBusId(null);

    const { active, over } = event;
    if (!over || !data) return;

    const overId = String(over.id);
    if (!overId.startsWith("bus:")) return; // dropped back to pool or nowhere

    const targetBusId = Number(overId.replace("bus:", ""));
    const parsed = parseDragId(String(active.id));
    if (!parsed) return;

    const { type, passengerId, source } = parsed;
    const sourceBusId = source === "pool" || source === "waitlist" ? null : Number(source);

    // No-op if same bus
    if (sourceBusId === targetBusId) return;

    // Check target bus isn't full and isn't the waitlist bus
    const targetBus = data.buses.find(b => b.id === targetBusId);
    if (!targetBus) return;
    if (targetBus.isWaitlistBus) {
      toast({ title: "Nicht möglich", description: "Warteliste wird automatisch über den Status gesteuert.", variant: "destructive" });
      return;
    }
    if (targetBus.assignments.length >= targetBus.capacity) {
      toast({ title: "Bus ist voll", description: `${targetBus.name} hat keine freien Plätze mehr.`, variant: "destructive" });
      return;
    }

    // If moving from another bus, remove first then assign
    if (sourceBusId !== null) {
      removePassenger(sourceBusId, type, passengerId)
        .then(() => assignPassenger(targetBusId, type, passengerId))
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ["admin-buses"] });
          queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
        })
        .catch((err: Error) => {
          toast({ title: "Fehler", description: err.message, variant: "destructive" });
          queryClient.invalidateQueries({ queryKey: ["admin-buses"] });
        });
    } else {
      assignMutation.mutate({ busId: targetBusId, type, id: passengerId });
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

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

  const regularBuses = data.buses.filter(b => !b.isWaitlistBus);
  const waitlistBus = data.buses.find(b => b.isWaitlistBus);

  const totalCapacity = regularBuses.reduce((s, b) => s + b.capacity, 0);
  const totalAssigned = regularBuses.reduce((s, b) => s + b.assignments.length, 0);
  const totalSiblings = regularBuses.reduce(
    (s, b) => s + b.assignments.filter(p => p.type === "sibling").length,
    0
  );
  const totalWaitlisted = waitlistBus?.assignments.length ?? 0;

  return (
    <AdminLayout>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-[#004289]">Busverwaltung</h1>
              <p className="text-gray-500 text-sm mt-1">
                Schüler per <strong>Drag & Drop</strong> auf Busse ziehen. Umzug zwischen Bussen direkt möglich.
              </p>
            </div>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              className="bg-[#004289] hover:bg-[#003070] gap-2 shrink-0"
            >
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Bus anlegen
            </Button>
            <div className="flex gap-3 text-sm">
              <div className="bg-white border border-gray-200 rounded px-3 py-2 text-center">
                <div className="text-lg font-bold text-[#004289]">{totalAssigned}</div>
                <div className="text-xs text-gray-500">Belegt</div>
              </div>
              <div className="bg-white border border-gray-200 rounded px-3 py-2 text-center">
                <div className="text-lg font-bold text-blue-500">{totalSiblings}</div>
                <div className="text-xs text-gray-500 flex items-center gap-1"><Users className="w-3 h-3" /> Geschwister</div>
              </div>
              <div className="bg-white border border-gray-200 rounded px-3 py-2 text-center">
                <div className="text-lg font-bold text-gray-400">{totalCapacity - totalAssigned}</div>
                <div className="text-xs text-gray-500">Frei</div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded px-3 py-2 text-center">
                <div className="text-lg font-bold text-amber-600">{totalWaitlisted}</div>
                <div className="text-xs text-amber-600/70">Warteliste</div>
              </div>
            </div>
          </div>

          {/* Warteliste Bus Card */}
          {waitlistBus && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <WaitlistBusCard bus={waitlistBus} />
            </div>
          )}

          {/* Regular bus grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {regularBuses.map(bus => (
              <BusCard
                key={bus.id}
                bus={bus}
                overBusId={overBusId}
                onRemove={(passenger) => handleRemove(bus, passenger)}
                onDelete={() => deleteMutation.mutate(bus.id)}
                removingKey={removingKey}
              />
            ))}
          </div>

          {/* Unassigned pool */}
          <UnassignedPool passengers={data.unassigned} />
        </div>

        {/* Drag overlay */}
        <DragOverlay dropAnimation={null}>
          {activePassenger && <PassengerGhost passenger={activePassenger} />}
        </DragOverlay>


      </DndContext>
    </AdminLayout>
  );
}
