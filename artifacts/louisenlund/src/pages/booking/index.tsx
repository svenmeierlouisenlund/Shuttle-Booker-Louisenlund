import { useState, useEffect, useRef, lazy, Suspense } from "react";

const ZoneMap = lazy(() => import("@/components/zone-map").then(m => ({ default: m.ZoneMap })));
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

// ── Tarifzonen-Erkennung via Point-in-Polygon ─────────────────────────────────
const _Z1: [number,number][] = [[54.5028911,9.8013835],[54.5127896,9.7593345],[54.5224704,9.7273286],[54.524222,9.7193813],[54.5231833,9.7086871],[54.5294736,9.6975959],[54.5320756,9.6324887],[54.5362692,9.6004539],[54.5466817,9.5838008],[54.5370472,9.5567597],[54.5321856,9.5235495],[54.5165076,9.5163414],[54.4998331,9.515488],[54.4889039,9.5245454],[54.4785732,9.5370342],[54.4744731,9.5438056],[54.4717799,9.5529037],[54.4685667,9.5685721],[54.4677457,9.584239],[54.4603367,9.6060825],[54.4571135,9.6330695],[54.4469457,9.7571848],[54.4365519,9.8236137],[54.4301671,9.8464348],[54.4270724,9.8618795],[54.4334104,9.8809796],[54.4438395,9.8985438],[54.4516181,9.9068031],[54.4506896,9.8985457],[54.4509581,9.8912331],[54.4474996,9.865623],[54.4536193,9.8523713],[54.4596805,9.8449887],[54.4660908,9.8416386],[54.4738228,9.8416374],[54.4749705,9.8387187],[54.4763174,9.8392764],[54.4768911,9.8448338],[54.4766792,9.846368],[54.4769598,9.8497529],[54.4764922,9.8521079],[54.4766799,9.8547697],[54.4757183,9.8560789],[54.4753553,9.8555855],[54.4727838,9.8613792],[54.4734756,9.8696189],[54.5036884,9.8526245],[54.5066413,9.8446241],[54.5069776,9.8339133]];
const _Z2: [number,number][] = [[54.523519,9.411283],[54.458482,9.4376274],[54.4097577,9.4767662],[54.3518009,9.6337562],[54.3679621,9.8348558],[54.3625204,9.9234529],[54.3715725,10.007241],[54.3826033,10.0560431],[54.3976002,10.0890063],[54.4321555,10.1687294],[54.4357198,10.1690382],[54.4369416,10.1730422],[54.4360549,10.1737567],[54.4363163,10.1749004],[54.4387098,10.1775014],[54.4433162,10.1809513],[54.4457014,10.1822551],[54.4477871,10.1852758],[54.4481761,10.188554],[54.4482906,10.1915318],[54.4499416,10.1952991],[54.4534017,10.1968771],[54.4543416,10.1974863],[54.4554311,10.1991254],[54.4559137,10.1987129],[54.4559434,10.1941541],[54.4560194,10.1931217],[54.4564447,10.1920893],[54.457445,10.1894235],[54.4608848,10.1829868],[54.4651725,10.1765489],[54.4674221,10.1732329],[54.4694971,10.1696162],[54.4733971,10.1619526],[54.4755295,10.1570833],[54.4788583,10.1473206],[54.4822617,10.1396597],[54.483689,10.1356142],[54.4849665,10.1306243],[54.4851167,10.1195778],[54.4845931,10.1135826],[54.48377,10.107845],[54.4806744,10.0843815],[54.4803735,10.0770999],[54.480267,10.0741851],[54.4806093,10.0727295],[54.4801968,10.0720498],[54.4803209,10.069178],[54.4802206,10.0682803],[54.4796714,10.0663527],[54.4793716,10.0642534],[54.4787219,10.0614282],[54.4782717,10.0583456],[54.4778697,10.0523949],[54.4771434,10.0467877],[54.4768618,10.0371185],[54.4763895,10.0358777],[54.4758673,10.0321479],[54.4756442,10.0286327],[54.4756704,10.0245167],[54.4750768,10.0191252],[54.4740388,10.0149514],[54.4739809,10.0122748],[54.4732746,10.0098128],[54.4685696,9.9967791],[54.4680793,9.9891329],[54.4683867,9.9847911],[54.4678959,9.9800202],[54.4679535,9.9742194],[54.4671858,9.9662084],[54.4668315,9.9627037],[54.4661778,9.9590274],[54.4641217,9.9514177],[54.4629516,9.9395894],[54.4625456,9.9358177],[54.4622892,9.9313165],[54.4620006,9.9297084],[54.4619614,9.9281003],[54.4619971,9.9269214],[54.4622821,9.9259142],[54.4621253,9.9242884],[54.4615684,9.9233455],[54.4603629,9.9230035],[54.4592198,9.9230692],[54.4582014,9.9224054],[54.4547764,9.9193212],[54.4522992,9.9134911],[54.4516181,9.9068031],[54.4438395,9.8985438],[54.4334104,9.8809796],[54.4270724,9.8618795],[54.4301671,9.8464348],[54.4365519,9.8236137],[54.4469457,9.7571848],[54.4488303,9.7343497],[54.4525848,9.6881769],[54.4543193,9.6669726],[54.4571135,9.6330695],[54.4603367,9.6060825],[54.4677457,9.584239],[54.4685667,9.5685721],[54.4744731,9.5438056],[54.4785732,9.5370342],[54.4889039,9.5245454],[54.4998331,9.515488],[54.5165076,9.5163414],[54.5321856,9.5235495],[54.5370472,9.5567597],[54.5466817,9.5838008],[54.5362692,9.6004539],[54.5320756,9.6324887],[54.5294736,9.6975959],[54.5231833,9.7086871],[54.524222,9.7193813],[54.5224704,9.7273286],[54.5127896,9.7593345],[54.5028911,9.8013835],[54.5069776,9.8339133],[54.5066413,9.8446241],[54.5036884,9.8526245],[54.4734756,9.8696189],[54.5009148,9.9600596],[54.5048025,9.9693264],[54.5104838,9.9758484],[54.5126763,9.9844325],[54.5170606,9.9904417],[54.518854,9.9939617],[54.5230383,9.9991984],[54.5435708,10.0137343],[54.5756901,9.9619727],[54.6220305,9.7750335],[54.6349487,9.6346145],[54.6087211,9.5743208],[54.5884241,9.4929938]];
const _Z3N: [number,number][] = [[54.6741569,9.9754539],[54.6752403,9.9593653],[54.6743917,9.9499474],[54.6735427,9.947739],[54.6725287,9.9437125],[54.6723554,9.9399365],[54.6697999,9.9371905],[54.6722329,9.9282658],[54.6767007,9.9200286],[54.6777933,9.9088706],[54.6763049,9.9011461],[54.6765779,9.887241],[54.6782395,9.8760821],[54.6793773,9.8589145],[54.6811102,9.8388214],[54.6824442,9.8235335],[54.6851905,9.807799],[54.6879345,9.7872554],[54.6902453,9.7743182],[54.6919587,9.7648128],[54.6916868,9.7532471],[54.69191,9.7480322],[54.6913392,9.7441907],[54.6890067,9.7365082],[54.6864234,9.7263338],[54.6814585,9.7195942],[54.6786729,9.7074904],[54.6815078,9.6939231],[54.6865241,9.6779542],[54.688021,9.6648989],[54.6840645,9.6442845],[54.6868617,9.6264011],[54.6902606,9.6175605],[54.6952469,9.6193624],[54.7004569,9.6099184],[54.7001613,9.5903407],[54.6908373,9.5803792],[54.6832967,9.5834649],[54.677591,9.5790833],[54.6746635,9.5637176],[54.6735697,9.5398556],[54.6662932,9.5249099],[54.6647732,9.513056],[54.6569662,9.500339],[54.6488956,9.4838397],[54.6470507,9.4659537],[54.6421668,9.4549091],[54.6357751,9.4438185],[54.6306376,9.436133],[54.6245057,9.4284496],[54.6158185,9.4192663],[54.6069021,9.4119306],[54.5983824,9.4076869],[54.590658,9.4031012],[54.5829335,9.4067554],[54.523519,9.411283],[54.5884241,9.4929938],[54.6087211,9.5743208],[54.6349487,9.6346145],[54.6220305,9.7750335],[54.5756901,9.9619727],[54.5435708,10.0137343],[54.5458603,10.0159652],[54.5461087,10.0171662],[54.5465442,10.0202129],[54.5477762,10.0231739],[54.5491077,10.025148],[54.5504392,10.0267789],[54.5528281,10.0271228],[54.5707465,10.0260082],[54.5797112,10.0254501],[54.5813133,10.0274671],[54.5847757,10.0275316],[54.5868455,10.0258793],[54.5935713,10.0258361],[54.6075442,10.0281524],[54.6170925,10.0327888],[54.6219853,10.0336044],[54.6269774,10.0330467],[54.632218,10.0325747],[54.6374586,10.0305575],[54.6484365,10.0310719],[54.6548689,10.0328315],[54.6572408,10.0333681],[54.6576268,10.0318446],[54.6601966,10.032414],[54.6600853,10.0294643],[54.6581747,10.0249383],[54.6595405,10.0165498],[54.6614643,10.013557],[54.6618987,10.0093623],[54.6676815,10.0057795],[54.6734643,10.0039126],[54.6739732,10.0027215],[54.6738865,10.0010154],[54.6729064,9.9995668],[54.6717277,9.9988049],[54.6704494,9.9978385],[54.6687182,9.9987286],[54.6662922,9.9967006],[54.6669122,9.9891037],[54.6690774,9.9897795],[54.6703491,9.9887386],[54.6701626,9.9847685]];
const _Z3S: [number,number][] = [[54.3518009,9.6337562],[54.346541,9.6954894],[54.3421039,9.7057504],[54.3386672,9.7130912],[54.3451208,9.7445814],[54.3270377,9.8169231],[54.3265557,9.8315669],[54.3183495,9.859378],[54.3163461,9.8775733],[54.3175451,9.8889018],[54.2930935,9.9204947],[54.2923049,9.9520732],[54.3022767,9.9555131],[54.3069615,9.965989],[54.3073389,9.9783535],[54.2997369,10.0049673],[54.3016302,10.038608],[54.2891509,10.0533641],[54.2742666,10.0502636],[54.2698877,10.0743075],[54.2779347,10.0911436],[54.2735505,10.1019702],[54.2705683,10.1162278],[54.278035,10.1282437],[54.2706408,10.1491018],[54.2678533,10.1744174],[54.2819869,10.1782573],[54.2742194,10.1942569],[54.2775743,10.2145434],[54.2854682,10.2083206],[54.280935,10.2285342],[54.2768765,10.2514511],[54.2834872,10.2610637],[54.2953093,10.2342841],[54.3075288,10.223128],[54.313238,10.2145446],[54.3173448,10.2148867],[54.3247027,10.2209351],[54.3312596,10.2201179],[54.3290008,10.2277985],[54.3331478,10.2344493],[54.3409413,10.2355647],[54.3491226,10.217536],[54.3468729,10.2089427],[54.3425704,10.1896936],[54.33894,10.1748413],[54.3412168,10.1753568],[54.344169,10.1751857],[54.3463711,10.1736644],[54.3479725,10.1747062],[54.3482731,10.1738597],[54.3505222,10.1768203],[54.3525722,10.1779144],[54.3547222,10.1774207],[54.3573607,10.1798678],[54.3591988,10.1793967],[54.3611709,10.1778071],[54.3625983,10.1819692],[54.3651616,10.194006],[54.3659743,10.1957008],[54.3673089,10.1964276],[54.3692435,10.1966823],[54.3725088,10.1943605],[54.3736367,10.1960936],[54.3749146,10.1967969],[54.3794505,10.1938138],[54.3802892,10.1980845],[54.3804738,10.1993882],[54.3809584,10.2006061],[54.3822274,10.2028704],[54.3845474,10.2045799],[54.3872818,10.2079239],[54.3889166,10.2080495],[54.3899871,10.2079789],[54.3914075,10.2090241],[54.40962,10.1889903],[54.4203888,10.1785193],[54.4321555,10.1687294],[54.3976002,10.0890063],[54.3826033,10.0560431],[54.3715725,10.007241],[54.3625204,9.9234529],[54.3679621,9.8348558]];

function _pip(lat: number, lon: number, poly: [number,number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [li, oi] = poly[i], [lj, oj] = poly[j];
    if (((li > lat) !== (lj > lat)) && lon < (oj - oi) * (lat - li) / (lj - li) + oi) inside = !inside;
  }
  return inside;
}
function detectZoneCoords(lat: number, lon: number): "zone1" | "zone2" | "zone3" | null {
  if (_pip(lat, lon, _Z1)) return "zone1";
  if (_pip(lat, lon, _Z2)) return "zone2";
  if (_pip(lat, lon, _Z3N) || _pip(lat, lon, _Z3S)) return "zone3";
  return null;
}
async function detectZoneForPLZ(plz: string): Promise<"zone1" | "zone2" | "zone3" | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(plz)}&country=de&format=json&limit=1`;
    const res = await fetch(url, { headers: { "Accept-Language": "de", "User-Agent": "LouisenlundShuttle/1.0" } });
    if (!res.ok) return null;
    const data = await res.json() as Array<{ lat: string; lon: string }>;
    if (!data.length) return null;
    return detectZoneCoords(parseFloat(data[0].lat), parseFloat(data[0].lon));
  } catch { return null; }
}
const ZONE_LABEL: Record<string, string> = { zone1: "Tarifzone 1", zone2: "Tarifzone 2", zone3: "Tarifzone 3" };
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
  const [suggestedZone, setSuggestedZone] = useState<"zone1" | "zone2" | "zone3" | null>(null);
  const [zoneDetecting, setZoneDetecting] = useState(false);
  const detectedForPLZ = useRef<string | null>(null);
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

  // Auto-detect tariff zone when user reaches step 2 (index 1)
  useEffect(() => {
    if (currentStep !== 1) return;
    const plz = form.getValues("childPostalCode").trim();
    if (!plz || plz === detectedForPLZ.current) return;
    detectedForPLZ.current = plz;
    setZoneDetecting(true);
    setSuggestedZone(null);
    detectZoneForPLZ(plz).then((zone) => {
      setZoneDetecting(false);
      setSuggestedZone(zone);
      if (zone) form.setValue("tariffZone", zone, { shouldValidate: true });
    });
  }, [currentStep]); // eslint-disable-line react-hooks/exhaustive-deps

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
      case 1: {
        const plzValue = form.getValues("childPostalCode");
        return (
          <div className="space-y-6">
            <p className="text-muted-foreground">
              Bitte wählen Sie die zutreffende Tarifzone basierend auf Ihrem Wohnort.
              Die Karte unten zeigt die Zoneneinteilung.
            </p>
            <div className="rounded-md overflow-hidden border border-gray-200">
              <Suspense fallback={<div className="flex items-center justify-center bg-gray-50 text-sm text-muted-foreground" style={{ height: 360 }}>Karte wird geladen …</div>}>
                <ZoneMap selectedZone={form.watch("tariffZone") || null} height={360} />
              </Suspense>
            </div>
            <div className="flex gap-4 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1.5"><span className="inline-block w-4 h-3 rounded-sm" style={{ background: "#FFD600", border: "1.5px solid #b8860b" }} />Tarifzone 1</span>
              <span className="flex items-center gap-1.5"><span className="inline-block w-4 h-3 rounded-sm" style={{ background: "#558B2F", border: "1.5px solid #2d6a1f" }} />Tarifzone 2</span>
              <span className="flex items-center gap-1.5"><span className="inline-block w-4 h-3 rounded-sm" style={{ background: "#A52714", border: "1.5px solid #7f1a0a" }} />Tarifzone 3</span>
              <span className="flex items-center gap-1.5 ml-2"><span className="inline-block w-3 h-3 rounded-full" style={{ background: "#004289", border: "2px solid white", boxShadow: "0 0 0 1px #004289" }} />Stiftung Louisenlund</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Liegt der von der Verwaltung vorgegebene Abholort in einer <strong className="text-foreground">günstigeren Tarifzone</strong> als Ihr Wohnort, werden die Kosten der günstigeren Zone zugrunde gelegt.
            </p>

            {/* PLZ-based zone suggestion */}
            {plzValue && (
              <div className={`flex items-start gap-3 px-4 py-3 rounded-md border text-sm ${zoneDetecting ? "bg-gray-50 border-gray-200 text-gray-600" : suggestedZone ? "bg-blue-50 border-blue-200 text-blue-900" : "bg-amber-50 border-amber-200 text-amber-900"}`}>
                <span className="text-base leading-tight mt-0.5">
                  {zoneDetecting ? "⏳" : suggestedZone ? "📍" : "⚠️"}
                </span>
                <div>
                  {zoneDetecting ? (
                    <span>Tarifzone für PLZ <strong>{plzValue}</strong> wird ermittelt …</span>
                  ) : suggestedZone ? (
                    <>
                      <span>PLZ <strong>{plzValue}</strong> liegt in <strong>{ZONE_LABEL[suggestedZone]}</strong> — diese Zone wurde für Sie vorausgewählt.</span>
                      <span className="block text-blue-700 text-xs mt-0.5">Sie können die Auswahl bei Bedarf unten manuell ändern.</span>
                    </>
                  ) : (
                    <span>Für PLZ <strong>{plzValue}</strong> konnte keine Zone automatisch ermittelt werden. Bitte wählen Sie anhand der Karte.</span>
                  )}
                </div>
              </div>
            )}

            <FormField
              control={form.control}
              name="tariffZone"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Tarifzone *</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
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
      }
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