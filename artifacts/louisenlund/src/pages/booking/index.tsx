import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Turnstile } from "@marsidev/react-turnstile";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronRight, ChevronLeft, Plus, Trash2 } from "lucide-react";
import logo from "@assets/Logo_-_Stiftung_Louisenlund_Print_1780387424925.png";

// ── Pricing helpers (mirrors server-side pricing.ts) ─────────────────────────
const GRADE_RANKS_FE: Record<string, number> = {
  "Jahrgang 1": 1, "Jahrgang 2": 2, "Jahrgang 3": 3, "Jahrgang 4": 4,
  "Jahrgang 5": 5, "Jahrgang 6": 6, "Jahrgang 7": 7, "Jahrgang 8": 8,
  "MYP3": 8, "Jahrgang 9": 9, "MYP4": 9, "Jahrgang 10": 10,
  "MYP5": 10, "E-Jahrgang": 11, "DP1": 11, "Q1-Jahrgang": 12,
  "DP2": 12, "Q2-Jahrgang": 13,
};
function gradeRankFE(grade: string): number { return GRADE_RANKS_FE[grade] ?? 0; }

const PRICE_TABLE_FE: Record<string, Record<string, Record<string, number>>> = {
  full_year:  { both: { zone1: 150000, zone2: 280000, zone3: 410000 }, one_way: { zone1: 75000, zone2: 140000, zone3: 205000 } },
  first_half: { both: { zone1:  85000, zone2: 155000, zone3: 230000 }, one_way: { zone1: 42500, zone2:  77500, zone3: 115000 } },
};
function calcChildPriceFE(zone: string, bType: string, out: string, ret: string, fullPayer: boolean): number {
  const rt = out !== "none" && ret !== "none" ? "both" : "one_way";
  const base = PRICE_TABLE_FE[bType]?.[rt]?.[zone] ?? 0;
  return fullPayer ? base : Math.round(base * 0.8);
}
function fmtPrice(cents: number): string {
  return (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
// ─────────────────────────────────────────────────────────────────────────────

const siblingSchema = z.object({
  childName: z.string().min(2, "Bitte geben Sie den Namen ein"),
  studentNumber: z.string().optional().nullable(),
  gradeYear: z.string().min(1, "Bitte wählen Sie die Klasse"),
  outboundRoute: z.enum(["zone1", "zone2", "zone3", "none"]),
  returnRoute: z.enum(["zone1", "zone2", "zone3", "none"]),
}).refine(data => data.outboundRoute !== "none" || data.returnRoute !== "none", {
  message: "Bitte wählen Sie mindestens eine Strecke (Hinfahrt oder Rückfahrt) aus.",
  path: ["outboundRoute"],
});

const formSchema = z.object({
  childName: z.string().min(2, "Bitte geben Sie den Namen des Kindes ein"),
  childAddress: z.string().min(2, "Bitte geben Sie die Straße ein"),
  childPostalCode: z.string().min(4, "Bitte geben Sie die PLZ ein"),
  childCity: z.string().min(2, "Bitte geben Sie den Wohnort ein"),
  studentNumber: z.string().optional().nullable(),
  gradeYear: z.string().min(1, "Bitte wählen Sie die Klasse"),
  parentName: z.string().min(2, "Bitte geben Sie den Namen eines Erziehungsberechtigten ein"),
  parentEmail: z.string().email("Bitte geben Sie eine gültige E-Mail-Adresse ein"),
  parentPhone: z.string().min(6, "Bitte geben Sie eine Telefonnummer ein"),
  tariffZone: z.enum(["zone1", "zone2", "zone3"]),
  bookingType: z.enum(["full_year", "first_half"]),
  outboundRoute: z.enum(["zone1", "zone2", "zone3", "none"]),
  returnRoute: z.enum(["zone1", "zone2", "zone3", "none"]),
  siblings: z.array(siblingSchema).max(3),
  confirmationAccepted: z.boolean().refine(val => val === true, { message: "Bitte bestätigen Sie die Angaben." }),
  signatureName: z.string().min(2, "Bitte unterschreiben Sie mit Ihrem Namen."),
  gdprConsent: z.boolean().refine(val => val === true, { message: "Bitte stimmen Sie der Datenschutzerklärung zu." }),
}).refine(data => data.outboundRoute !== "none" || data.returnRoute !== "none", {
  message: "Bitte wählen Sie mindestens eine Strecke für das Hauptkind (Hinfahrt oder Rückfahrt) aus.",
  path: ["outboundRoute"],
});

type FormValues = z.infer<typeof formSchema>;

const STEPS = [
  { id: "contact", name: "Kontaktdaten" },
  { id: "tariff", name: "Tarifzone" },
  { id: "booking_type", name: "Buchungsart" },
  { id: "route", name: "Strecken" },
  { id: "siblings", name: "Geschwister" },
  { id: "summary", name: "Zusammenfassung" },
];

export default function BookingForm() {
  const [currentStep, setCurrentStep] = useState(0);
  const [turnstileToken, setTurnstileToken] = useState<string>("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const submitBooking = useMutation({
    mutationFn: async (values: FormValues) => {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, cfTurnstileToken: turnstileToken }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? "Buchung fehlgeschlagen");
      }
      return res.json();
    },
    onSuccess: () => setLocation("/booking/success"),
    onError: (err: Error) => {
      toast({
        title: "Ein Fehler ist aufgetreten",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      childName: "",
      childAddress: "",
      childPostalCode: "",
      childCity: "",
      studentNumber: "",
      gradeYear: "",
      parentName: "",
      parentEmail: "",
      parentPhone: "",
      tariffZone: "zone1",
      bookingType: "full_year",
      outboundRoute: "none",
      returnRoute: "none",
      siblings: [],
      confirmationAccepted: false,
      signatureName: "",
      gdprConsent: false,
    },
    mode: "onChange"
  });

  const { fields: siblingFields, append: appendSibling, remove: removeSibling } = useFieldArray({
    control: form.control,
    name: "siblings",
  });

  const selectedZone = form.watch("tariffZone");
  const zoneLabel: Record<string, string> = {
    zone1: "Tarifzone 1",
    zone2: "Tarifzone 2",
    zone3: "Tarifzone 3",
  };

  const validateStep = async () => {
    let fieldsToValidate: any[] = [];
    switch (currentStep) {
      case 0:
        fieldsToValidate = ['childName', 'childAddress', 'childPostalCode', 'childCity', 'gradeYear', 'parentName', 'parentEmail', 'parentPhone'];
        break;
      case 1:
        fieldsToValidate = ['tariffZone'];
        break;
      case 2:
        fieldsToValidate = ['bookingType'];
        break;
      case 3:
        fieldsToValidate = ['outboundRoute', 'returnRoute'];
        break;
      case 4:
        fieldsToValidate = ['siblings'];
        break;
      default:
        break;
    }

    const isValid = await form.trigger(fieldsToValidate);
    
    // Additional custom validation for step 3
    if (currentStep === 3 && isValid) {
      const vals = form.getValues();
      if (vals.outboundRoute === "none" && vals.returnRoute === "none") {
        form.setError("outboundRoute", { message: "Bitte wählen Sie mindestens eine Strecke (Hinfahrt oder Rückfahrt) aus." });
        return false;
      }
    }
    
    // Step 4 siblings custom validation
    if (currentStep === 4 && isValid) {
      const vals = form.getValues();
      let hasError = false;
      vals.siblings.forEach((s, i) => {
        if (s.outboundRoute === "none" && s.returnRoute === "none") {
          form.setError(`siblings.${i}.outboundRoute`, { message: "Bitte wählen Sie mindestens eine Strecke aus." });
          hasError = true;
        }
      });
      if (hasError) return false;
    }

    return isValid;
  };

  const nextStep = async () => {
    const isValid = await validateStep();
    if (isValid) {
      const next = Math.min(currentStep + 1, STEPS.length - 1);
      // Auto-fill signature with parent name when entering the summary step
      if (next === 5) {
        const parentName = form.getValues("parentName");
        form.setValue("signatureName", parentName, { shouldValidate: false });
      }
      setCurrentStep(next);
      window.scrollTo(0, 0);
    }
  };

  const prevStep = () => {
    setCurrentStep(s => Math.max(s - 1, 0));
    window.scrollTo(0, 0);
  };

  const onSubmit = (data: FormValues) => {
    if (!turnstileToken) {
      toast({
        title: "Sicherheitsüberprüfung",
        description: "Bitte schließen Sie die Sicherheitsüberprüfung ab.",
        variant: "destructive",
      });
      return;
    }
    submitBooking.mutate(data);
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-primary">Angaben zum Kind</h3>
              <FormField
                control={form.control}
                name="childName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name des Kindes *</FormLabel>
                    <FormControl><Input placeholder="Vor- und Nachname" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="childAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Straße und Hausnummer *</FormLabel>
                    <FormControl><Input placeholder="Musterstraße 12" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                <FormField
                  control={form.control}
                  name="childPostalCode"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>PLZ *</FormLabel>
                      <FormControl><Input placeholder="24340" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="childCity"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-3">
                      <FormLabel>Wohnort *</FormLabel>
                      <FormControl><Input placeholder="Eckernförde" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="gradeYear"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Klasse im SJ 2026/27 *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Bitte wählen" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {["Jahrgang 1","Jahrgang 2","Jahrgang 3","Jahrgang 4","Jahrgang 5","Jahrgang 6","Jahrgang 7","Jahrgang 8","Jahrgang 9","Jahrgang 10","E-Jahrgang","Q1-Jahrgang","Q2-Jahrgang","MYP3","MYP4","MYP5","DP1","DP2"].map(g => (
                            <SelectItem key={g} value={g}>{g}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="studentNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Schülernummer (optional)</FormLabel>
                      <FormControl><Input placeholder="Falls bekannt" {...field} value={field.value || ""} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="space-y-4 pt-6 border-t border-border">
              <h3 className="text-lg font-semibold text-primary">Angaben der Erziehungsberechtigten</h3>
              <FormField
                control={form.control}
                name="parentName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name *</FormLabel>
                    <FormControl><Input placeholder="Vor- und Nachname" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="parentEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-Mail *</FormLabel>
                      <FormControl><Input type="email" placeholder="mail@example.com" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="parentPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefon / Mobil *</FormLabel>
                      <FormControl><Input type="tel" placeholder="+49..." {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </div>
        );
      case 1:
        return (
          <div className="space-y-6">
            <p className="text-muted-foreground">
              Bitte wählen Sie die zutreffende Tarifzone basierend auf Ihrem Wohnort.
              Die Karte unten zeigt die Zoneneinteilung.
            </p>
            <div className="rounded-md overflow-hidden border border-gray-200">
              <iframe
                src="https://www.google.com/maps/d/embed?mid=1vPST9Agi2z_2eFKFFRueE9TUfPlYAT8"
                width="100%"
                height="360"
                style={{ border: 0, display: "block" }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Karte der Tarifzonen"
              />
            </div>
            <FormField
              control={form.control}
              name="tariffZone"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Tarifzone *</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex flex-col space-y-2"
                    >
                      <FormItem className="flex items-center space-x-3 space-y-0 p-4 border rounded-md cursor-pointer hover:bg-muted/50 transition-colors">
                        <FormControl>
                          <RadioGroupItem value="zone1" />
                        </FormControl>
                        <div className="flex-1">
                          <FormLabel className="font-normal cursor-pointer text-base">Tarifzone 1</FormLabel>
                        </div>
                      </FormItem>
                      <FormItem className="flex items-center space-x-3 space-y-0 p-4 border rounded-md cursor-pointer hover:bg-muted/50 transition-colors">
                        <FormControl>
                          <RadioGroupItem value="zone2" />
                        </FormControl>
                        <div className="flex-1">
                          <FormLabel className="font-normal cursor-pointer text-base">Tarifzone 2</FormLabel>
                        </div>
                      </FormItem>
                      <FormItem className="flex items-center space-x-3 space-y-0 p-4 border rounded-md cursor-pointer hover:bg-muted/50 transition-colors">
                        <FormControl>
                          <RadioGroupItem value="zone3" />
                        </FormControl>
                        <div className="flex-1">
                          <FormLabel className="font-normal cursor-pointer text-base">Tarifzone 3</FormLabel>
                        </div>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        );
      case 2:
        return (
          <div className="space-y-6">
            <FormField
              control={form.control}
              name="bookingType"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Buchungszeitraum *</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex flex-col space-y-2"
                    >
                      <FormItem className="flex items-center space-x-3 space-y-0 p-4 border rounded-md cursor-pointer hover:bg-muted/50 transition-colors">
                        <FormControl>
                          <RadioGroupItem value="full_year" />
                        </FormControl>
                        <div className="flex-1">
                          <FormLabel className="font-medium cursor-pointer text-base block mb-1">Gesamtes Schuljahr 2026/27</FormLabel>
                          <FormDescription className="cursor-pointer">Bindend für das gesamte Schuljahr.</FormDescription>
                        </div>
                      </FormItem>
                      <FormItem className="flex items-center space-x-3 space-y-0 p-4 border rounded-md cursor-pointer hover:bg-muted/50 transition-colors">
                        <FormControl>
                          <RadioGroupItem value="first_half" />
                        </FormControl>
                        <div className="flex-1">
                          <FormLabel className="font-medium cursor-pointer text-base block mb-1">1. Schulhalbjahr 2026/27</FormLabel>
                          <FormDescription className="cursor-pointer">Nur für das erste Schulhalbjahr.</FormDescription>
                        </div>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="bg-secondary/30 p-4 rounded-md text-sm text-muted-foreground border border-secondary">
              Die Abrechnung erfolgt bequem über das bestehende Elternkonto.
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-8">
            <div className="bg-muted p-4 rounded-md mb-6">
              <p className="text-sm">Bitte wählen Sie, an welchen Strecken Ihr Kind teilnehmen soll. Sie müssen mindestens eine Strecke auswählen.</p>
              <p className="text-sm mt-2 font-medium text-primary">Hinweis: Die Rückfahrten erfolgen um 14:30 Uhr oder 16:30 Uhr, sofern für Ihre Tarifzone verfügbar.</p>
            </div>
            
            <FormField
              control={form.control}
              name="outboundRoute"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Hinfahrt (Morgens)</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Bitte wählen" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="none">Keine Hinfahrt benötigt</SelectItem>
                      {selectedZone && (
                        <SelectItem value={selectedZone}>{zoneLabel[selectedZone]}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="returnRoute"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Rückfahrt (Nachmittags)</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Bitte wählen" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="none">Keine Rückfahrt benötigt</SelectItem>
                      {selectedZone && (
                        <SelectItem value={selectedZone}>{zoneLabel[selectedZone]}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        );
      case 4:
        return (
          <div className="space-y-6">
            <div className="bg-secondary/30 p-4 rounded-md text-sm mb-6 border border-secondary">
              Das Kind mit der <span className="font-semibold text-primary">höchsten Klassenstufe</span> gilt als Vollzahler. Alle weiteren Kinder erhalten einen <span className="font-semibold text-primary">Geschwisterrabatt von 20 %</span>.
            </div>

            {siblingFields.map((field, index) => (
              <Card key={field.id} className="relative shadow-sm border-primary/10">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute top-2 right-2 text-destructive hover:bg-destructive/10" 
                  onClick={() => removeSibling(index)}
                  type="button"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
                <CardContent className="pt-6 space-y-4">
                  <h4 className="font-semibold text-primary">Geschwisterkind {index + 1}</h4>
                  <FormField
                    control={form.control}
                    name={`siblings.${index}.childName`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl><Input placeholder="Vor- und Nachname" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name={`siblings.${index}.gradeYear`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Klasse *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Bitte wählen" /></SelectTrigger></FormControl>
                            <SelectContent>
                              {["Jahrgang 1","Jahrgang 2","Jahrgang 3","Jahrgang 4","Jahrgang 5","Jahrgang 6","Jahrgang 7","Jahrgang 8","Jahrgang 9","Jahrgang 10","E-Jahrgang","Q1-Jahrgang","Q2-Jahrgang","MYP3","MYP4","MYP5","DP1","DP2"].map(g => (
                                <SelectItem key={g} value={g}>{g}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`siblings.${index}.studentNumber`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Schülernummer (optional)</FormLabel>
                          <FormControl><Input placeholder="Falls bekannt" {...field} value={field.value || ""} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name={`siblings.${index}.outboundRoute`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Hinfahrt</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Bitte wählen" /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="none">Keine</SelectItem>
                              {selectedZone && (
                                <SelectItem value={selectedZone}>{zoneLabel[selectedZone]}</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`siblings.${index}.returnRoute`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Rückfahrt</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Bitte wählen" /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="none">Keine</SelectItem>
                              {selectedZone && (
                                <SelectItem value={selectedZone}>{zoneLabel[selectedZone]}</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}

            {siblingFields.length < 3 && (
              <Button 
                type="button" 
                variant="outline" 
                className="w-full border-dashed border-2 py-8 text-primary" 
                onClick={() => appendSibling({ childName: "", studentNumber: "", gradeYear: "", outboundRoute: "none", returnRoute: "none" })}
              >
                <Plus className="w-4 h-4 mr-2" /> Geschwisterkind hinzufügen
              </Button>
            )}
          </div>
        );
      case 5:
        const data = form.getValues();
        return (
          <div className="space-y-8">
            <div className="bg-muted p-6 rounded-md space-y-6">
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Kind</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="font-medium">Name:</div><div>{data.childName}</div>
                  <div className="font-medium">Klasse:</div><div>{data.gradeYear}</div>
                  <div className="font-medium">Straße:</div><div>{data.childAddress}</div>
                  <div className="font-medium">PLZ / Ort:</div><div>{data.childPostalCode} {data.childCity}</div>
                </div>
              </div>
              
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Strecken & Tarif</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="font-medium">Tarifzone:</div><div>Tarifzone {data.tariffZone.replace("zone", "")}</div>
                  <div className="font-medium">Zeitraum:</div><div>{data.bookingType === "full_year" ? "Gesamtes Schuljahr 2026/27" : "1. Schulhalbjahr 2026/27"}</div>
                  <div className="font-medium">Hinfahrt:</div><div>{data.outboundRoute === "none" ? "Keine" : `Tarifzone ${data.outboundRoute.replace("zone", "")}`}</div>
                  <div className="font-medium">Rückfahrt:</div><div>{data.returnRoute === "none" ? "Keine" : `Tarifzone ${data.returnRoute.replace("zone", "")}`}</div>
                </div>
              </div>

              {data.siblings.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Geschwisterkinder</h4>
                  <div className="space-y-2">
                    {data.siblings.map((s, i) => (
                      <div key={i} className="text-sm border-l-2 border-primary/30 pl-3">
                        <div className="font-medium">{s.childName} (Klasse {s.gradeYear})</div>
                        <div className="text-muted-foreground text-xs">
                          Hin: {s.outboundRoute === "none" ? "Keine" : `Zone ${s.outboundRoute.replace("zone", "")}`} | 
                          Rück: {s.returnRoute === "none" ? "Keine" : `Zone ${s.returnRoute.replace("zone", "")}`}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Price breakdown */}
              {(() => {
                const validSiblings = data.siblings.filter(
                  s => s.outboundRoute !== "none" || s.returnRoute !== "none",
                );
                const allGrades = [data.gradeYear, ...validSiblings.map(s => s.gradeYear)];
                const maxRank = Math.max(...allGrades.map(gradeRankFE));
                const mainIsFullPayer = gradeRankFE(data.gradeYear) >= maxRank;
                const hasMultipleChildren = data.siblings.length > 0;

                // Determine full-payer flag for each sibling
                let fullPayerSiblingFound = mainIsFullPayer;
                const siblingFullPayer = data.siblings.map(s => {
                  if (s.outboundRoute === "none" && s.returnRoute === "none") return false;
                  const isFP = !fullPayerSiblingFound && gradeRankFE(s.gradeYear) === maxRank;
                  if (isFP) fullPayerSiblingFound = true;
                  return isFP;
                });

                const mainPrice = calcChildPriceFE(data.tariffZone, data.bookingType, data.outboundRoute, data.returnRoute, mainIsFullPayer);
                const siblingPrices = data.siblings.map((s, i) =>
                  (s.outboundRoute === "none" && s.returnRoute === "none") ? 0
                    : calcChildPriceFE(data.tariffZone, data.bookingType, s.outboundRoute, s.returnRoute, siblingFullPayer[i]),
                );
                const total = mainPrice + siblingPrices.reduce((a, b) => a + b, 0);

                return (
                  <div>
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Preisübersicht</h4>
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-sm">
                        <span className="flex items-center gap-1.5">
                          {data.childName} ({data.gradeYear})
                          {hasMultipleChildren && mainIsFullPayer && (
                            <span className="text-[11px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-semibold">Vollzahler</span>
                          )}
                          {hasMultipleChildren && !mainIsFullPayer && (
                            <span className="text-[11px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-semibold">Geschwister –20 %</span>
                          )}
                        </span>
                        <span className="font-medium tabular-nums">{fmtPrice(mainPrice)}</span>
                      </div>
                      {data.siblings.map((s, i) => {
                        if (s.outboundRoute === "none" && s.returnRoute === "none") return null;
                        return (
                          <div key={i} className="flex justify-between items-center text-sm">
                            <span className="flex items-center gap-1.5">
                              {s.childName} ({s.gradeYear})
                              {siblingFullPayer[i] ? (
                                <span className="text-[11px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-semibold">Vollzahler</span>
                              ) : (
                                <span className="text-[11px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-semibold">Geschwister –20 %</span>
                              )}
                            </span>
                            <span className="font-medium tabular-nums">{fmtPrice(siblingPrices[i])}</span>
                          </div>
                        );
                      })}
                      <div className="flex justify-between items-center text-sm font-semibold border-t border-gray-200 pt-2 mt-1">
                        <span>Jahresbeitrag gesamt</span>
                        <span className="tabular-nums">{fmtPrice(total)}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="space-y-4">
              <FormField
                control={form.control}
                name="confirmationAccepted"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-4 border rounded-md">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="font-medium">Verbindliche Buchung</FormLabel>
                      <FormDescription>
                        Ich bestätige, dass die Angaben korrekt sind und die Buchung verbindlich erfolgt.
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="gdprConsent"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-4 border rounded-md">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="font-medium">Datenschutz</FormLabel>
                      <FormDescription>
                        Ich stimme der Verarbeitung meiner Daten gemäß der Datenschutzerklärung zu.
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="signatureName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Digitale Unterschrift (Vor- und Nachname) *</FormLabel>
                    <FormControl><Input placeholder="Ihr Name" {...field} className="font-serif italic" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Sicherheitsüberprüfung *</p>
              <Turnstile
                siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY ?? "1x00000000000000000000AA"}
                onSuccess={(token) => setTurnstileToken(token)}
                onError={() => setTurnstileToken("")}
                onExpire={() => setTurnstileToken("")}
                options={{ language: "de" }}
              />
              {!turnstileToken && (
                <p className="text-xs text-gray-500">Bitte bestätigen Sie, dass Sie kein Bot sind.</p>
              )}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-white">
      {/* Louisenlund branded header */}
      <header className="ll-header">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/">
              <div className="bg-white rounded px-2 py-1">
                <img src={logo} alt="Stiftung Louisenlund" className="h-9 w-auto" />
              </div>
            </a>
            <div className="text-blue-200 text-xs tracking-widest uppercase hidden sm:block">
              Buchungsportal Regionalshuttle
            </div>
          </div>
        </div>
        <div className="ll-accent-bar" />
      </header>

      <div className="flex-1 bg-[#f0f0f0] py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-semibold text-[#004289]">Buchung Regionalshuttle</h1>
            <p className="text-sm text-[#666666] mt-1">Schuljahr 2026/27</p>
          </div>

          {/* Progress bar */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs font-semibold tracking-wide uppercase text-[#004289]">
                Schritt {currentStep + 1} von {STEPS.length}
              </span>
              <span className="text-xs text-[#666666]">{STEPS[currentStep].name}</span>
            </div>
            <div className="w-full bg-gray-300 h-1">
              <div
                className="h-1 transition-all duration-300 ease-in-out"
                style={{
                  width: `${((currentStep + 1) / STEPS.length) * 100}%`,
                  backgroundColor: "#004289",
                }}
              />
            </div>
            {/* Step dots */}
            <div className="flex justify-between mt-2">
              {STEPS.map((step, i) => (
                <div
                  key={step.id}
                  className="flex flex-col items-center gap-0.5"
                  style={{ width: `${100 / STEPS.length}%` }}
                >
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: i <= currentStep ? "#004289" : "#cccccc",
                    }}
                  />
                  <span
                    className="text-[10px] hidden sm:block text-center leading-tight"
                    style={{ color: i === currentStep ? "#004289" : "#999999" }}
                  >
                    {step.name}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <Card className="shadow-sm border-gray-200 bg-white">
            <CardHeader className="border-b border-gray-100 pb-4" style={{ borderTop: "3px solid #004289" }}>
              <CardTitle className="text-lg font-semibold text-[#004289]">
                {STEPS[currentStep].name}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                  {renderStepContent()}
                </form>
              </Form>
            </CardContent>
            <CardFooter className="flex justify-between border-t border-gray-100 pt-5 bg-[#f9f9f9]">
              <Button
                variant="outline"
                onClick={prevStep}
                disabled={currentStep === 0 || submitBooking.isPending}
                className="border-gray-300 text-[#333333] hover:bg-gray-100"
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> Zurück
              </Button>

              {currentStep < STEPS.length - 1 ? (
                <Button
                  onClick={nextStep}
                  type="button"
                  className="bg-[#004289] hover:bg-[#003070] text-white"
                >
                  Weiter <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              ) : (
                <Button
                  onClick={form.handleSubmit(onSubmit)}
                  disabled={submitBooking.isPending || !turnstileToken}
                  className="bg-[#ce1329] hover:bg-[#b0101f] text-white font-semibold"
                >
                  {submitBooking.isPending ? "Wird gesendet..." : "Verbindlich buchen"}
                </Button>
              )}
            </CardFooter>
          </Card>
        </div>
      </div>

      <footer className="border-t border-gray-200 bg-white">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <p className="text-xs text-[#666666]">
            © {new Date().getFullYear()} Stiftung Louisenlund · D-24357 Güby ·
            Regionalshuttle in Kooperation mit MediCall Fahrdienst GmbH
          </p>
        </div>
      </footer>
    </div>
  );
}