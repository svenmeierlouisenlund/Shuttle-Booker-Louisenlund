import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, Info } from "lucide-react";
import { useState, useEffect } from "react";

interface PricingByZone { zone1: number; zone2: number; zone3: number; }
interface PricingPeriod { both: PricingByZone; oneWay: PricingByZone; }
interface PricingData {
  fullYear: PricingPeriod;
  firstHalf: PricingPeriod;
  updatedAt: string;
}

type FormValues = {
  fullYear: { both: Record<string, string>; oneWay: Record<string, string> };
  firstHalf: { both: Record<string, string>; oneWay: Record<string, string> };
};

function centsToEuros(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function eurosToCents(str: string): number {
  const normalized = str.replace(",", ".").replace(/[^\d.]/g, "");
  return Math.round(parseFloat(normalized) * 100);
}

function buildForm(data: PricingData): FormValues {
  return {
    fullYear: {
      both:   { zone1: centsToEuros(data.fullYear.both.zone1),   zone2: centsToEuros(data.fullYear.both.zone2),   zone3: centsToEuros(data.fullYear.both.zone3) },
      oneWay: { zone1: centsToEuros(data.fullYear.oneWay.zone1), zone2: centsToEuros(data.fullYear.oneWay.zone2), zone3: centsToEuros(data.fullYear.oneWay.zone3) },
    },
    firstHalf: {
      both:   { zone1: centsToEuros(data.firstHalf.both.zone1),   zone2: centsToEuros(data.firstHalf.both.zone2),   zone3: centsToEuros(data.firstHalf.both.zone3) },
      oneWay: { zone1: centsToEuros(data.firstHalf.oneWay.zone1), zone2: centsToEuros(data.firstHalf.oneWay.zone2), zone3: centsToEuros(data.firstHalf.oneWay.zone3) },
    },
  };
}

async function fetchPricing(): Promise<PricingData> {
  const res = await fetch("/api/admin/pricing", { credentials: "include" });
  if (!res.ok) throw new Error("Fehler beim Laden der Tarife");
  return res.json();
}

async function savePricing(form: FormValues): Promise<PricingData> {
  const body = {
    fullYear: {
      both:   { zone1: eurosToCents(form.fullYear.both.zone1),   zone2: eurosToCents(form.fullYear.both.zone2),   zone3: eurosToCents(form.fullYear.both.zone3) },
      oneWay: { zone1: eurosToCents(form.fullYear.oneWay.zone1), zone2: eurosToCents(form.fullYear.oneWay.zone2), zone3: eurosToCents(form.fullYear.oneWay.zone3) },
    },
    firstHalf: {
      both:   { zone1: eurosToCents(form.firstHalf.both.zone1),   zone2: eurosToCents(form.firstHalf.both.zone2),   zone3: eurosToCents(form.firstHalf.both.zone3) },
      oneWay: { zone1: eurosToCents(form.firstHalf.oneWay.zone1), zone2: eurosToCents(form.firstHalf.oneWay.zone2), zone3: eurosToCents(form.firstHalf.oneWay.zone3) },
    },
  };
  const res = await fetch("/api/admin/pricing", {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Fehler beim Speichern");
  }
  return res.json();
}

const ZONES = ["zone1", "zone2", "zone3"] as const;
const ZONE_LABELS: Record<string, string> = { zone1: "Zone 1", zone2: "Zone 2", zone3: "Zone 3" };

export default function AdminPricing() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormValues | null>(null);

  const { data, isLoading, error } = useQuery({ queryKey: ["admin-pricing"], queryFn: fetchPricing });

  useEffect(() => {
    if (data && !form) setForm(buildForm(data));
  }, [data, form]);

  const mutation = useMutation({
    mutationFn: savePricing,
    onSuccess: (saved) => {
      queryClient.setQueryData(["admin-pricing"], saved);
      setForm(buildForm(saved));
      toast({ title: "Tarife gespeichert", description: "Die Preistabelle wurde erfolgreich aktualisiert." });
    },
    onError: (err: Error) => {
      toast({ title: "Fehler", description: err.message, variant: "destructive" });
    },
  });

  const setVal = (period: "fullYear" | "firstHalf", rt: "both" | "oneWay", zone: string, val: string) => {
    setForm(prev => prev ? ({
      ...prev,
      [period]: { ...prev[period], [rt]: { ...prev[period][rt], [zone]: val } },
    }) : prev);
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[#004289]" />
        </div>
      </AdminLayout>
    );
  }

  if (error || !form) {
    return (
      <AdminLayout>
        <div className="text-center py-20 text-red-600">Fehler beim Laden der Tarife.</div>
      </AdminLayout>
    );
  }

  const updatedAt = data?.updatedAt ? new Date(data.updatedAt).toLocaleString("de-DE") : null;

  const PriceInput = ({ period, rt, zone }: { period: "fullYear" | "firstHalf"; rt: "both" | "oneWay"; zone: string }) => (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none">€</span>
      <Input
        type="text"
        inputMode="decimal"
        value={form[period][rt][zone]}
        onChange={e => setVal(period, rt, zone, e.target.value)}
        className="pl-7 text-right font-mono"
      />
    </div>
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#004289]">Tarifkonfiguration</h1>
            <p className="text-gray-500 text-sm mt-1">
              Grundpreise pro Kind und Buchungszeitraum. Der Geschwisterrabatt (−20 %) wird automatisch angewendet.
            </p>
          </div>
          <Button
            onClick={() => mutation.mutate(form)}
            disabled={mutation.isPending}
            className="bg-[#004289] hover:bg-[#003070] shrink-0"
          >
            {mutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Speichern
          </Button>
        </div>

        <div className="flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          <span>Alle Preise in Euro (z. B. <strong>1500,00</strong> für 1.500 €). Neue Buchungen verwenden sofort die aktualisierten Tarife.</span>
        </div>

        {/* Gesamtes Schuljahr */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-[#004289]">Gesamtes Schuljahr 2026/27</CardTitle>
            <CardDescription>Gültig für beide Schulhalbjahre</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left font-medium text-gray-500 py-2 pr-4 w-56">Fahrttyp</th>
                    {ZONES.map(z => (
                      <th key={z} className="text-center font-medium text-gray-500 py-2 px-2 min-w-[140px]">{ZONE_LABELS[z]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="py-3 pr-4">
                      <div className="font-medium text-gray-900">Hin- &amp; Rückfahrt</div>
                      <div className="text-xs text-gray-500">Beide Richtungen täglich</div>
                    </td>
                    {ZONES.map(z => (
                      <td key={z} className="py-3 px-2">
                        <PriceInput period="fullYear" rt="both" zone={z} />
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3 pr-4">
                      <div className="font-medium text-gray-900">Nur Hin- oder Rückfahrt</div>
                      <div className="text-xs text-gray-500">Eine Richtung täglich</div>
                    </td>
                    {ZONES.map(z => (
                      <td key={z} className="py-3 px-2">
                        <PriceInput period="fullYear" rt="oneWay" zone={z} />
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* 1. Schulhalbjahr */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-[#004289]">1. Schulhalbjahr 2026/27</CardTitle>
            <CardDescription>Nur erstes Schulhalbjahr</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left font-medium text-gray-500 py-2 pr-4 w-56">Fahrttyp</th>
                    {ZONES.map(z => (
                      <th key={z} className="text-center font-medium text-gray-500 py-2 px-2 min-w-[140px]">{ZONE_LABELS[z]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="py-3 pr-4">
                      <div className="font-medium text-gray-900">Hin- &amp; Rückfahrt</div>
                      <div className="text-xs text-gray-500">Beide Richtungen täglich</div>
                    </td>
                    {ZONES.map(z => (
                      <td key={z} className="py-3 px-2">
                        <PriceInput period="firstHalf" rt="both" zone={z} />
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3 pr-4">
                      <div className="font-medium text-gray-900">Nur Hin- oder Rückfahrt</div>
                      <div className="text-xs text-gray-500">Eine Richtung täglich</div>
                    </td>
                    {ZONES.map(z => (
                      <td key={z} className="py-3 px-2">
                        <PriceInput period="firstHalf" rt="oneWay" zone={z} />
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {updatedAt && (
          <p className="text-xs text-gray-400 text-right">Zuletzt geändert: {updatedAt}</p>
        )}
      </div>
    </AdminLayout>
  );
}
