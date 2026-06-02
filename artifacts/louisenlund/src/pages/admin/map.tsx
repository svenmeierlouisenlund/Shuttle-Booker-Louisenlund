import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { useListAdminBookings } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Loader2, AlertCircle } from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, useMap, Polygon, Tooltip } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// ---------------------------------------------------------------------------
// Tariff zone polygons (extracted from Google Maps KML, converted lon,lat → [lat,lon])
// ---------------------------------------------------------------------------

const ZONE1_COORDS: [number, number][] = [
  [54.5028911,9.8013835],[54.5127896,9.7593345],[54.5224704,9.7273286],[54.524222,9.7193813],
  [54.5231833,9.7086871],[54.5294736,9.6975959],[54.5320756,9.6324887],[54.5362692,9.6004539],
  [54.5466817,9.5838008],[54.5370472,9.5567597],[54.5321856,9.5235495],[54.5165076,9.5163414],
  [54.4998331,9.515488],[54.4889039,9.5245454],[54.4785732,9.5370342],[54.4744731,9.5438056],
  [54.4717799,9.5529037],[54.4685667,9.5685721],[54.4677457,9.584239],[54.4603367,9.6060825],
  [54.4571135,9.6330695],[54.4469457,9.7571848],[54.4365519,9.8236137],[54.4301671,9.8464348],
  [54.4270724,9.8618795],[54.4334104,9.8809796],[54.4438395,9.8985438],[54.4516181,9.9068031],
  [54.4506896,9.8985457],[54.4509581,9.8912331],[54.4474996,9.865623],[54.4536193,9.8523713],
  [54.4596805,9.8449887],[54.4660908,9.8416386],[54.4738228,9.8416374],[54.4749705,9.8387187],
  [54.4763174,9.8392764],[54.4768911,9.8448338],[54.4766792,9.846368],[54.4769598,9.8497529],
  [54.4764922,9.8521079],[54.4766799,9.8547697],[54.4757183,9.8560789],[54.4753553,9.8555855],
  [54.4727838,9.8613792],[54.4734756,9.8696189],[54.5036884,9.8526245],[54.5066413,9.8446241],
  [54.5069776,9.8339133],
];

const ZONE2_COORDS: [number, number][] = [
  [54.523519,9.411283],[54.458482,9.4376274],[54.4097577,9.4767662],[54.3518009,9.6337562],
  [54.3679621,9.8348558],[54.3625204,9.9234529],[54.3715725,10.007241],[54.3826033,10.0560431],
  [54.3976002,10.0890063],[54.4321555,10.1687294],[54.4357198,10.1690382],[54.4369416,10.1730422],
  [54.4360549,10.1737567],[54.4363163,10.1749004],[54.4387098,10.1775014],[54.4433162,10.1809513],
  [54.4457014,10.1822551],[54.4477871,10.1852758],[54.4481761,10.188554],[54.4482906,10.1915318],
  [54.4499416,10.1952991],[54.4534017,10.1968771],[54.4543416,10.1974863],[54.4554311,10.1991254],
  [54.4559137,10.1987129],[54.4559434,10.1941541],[54.4560194,10.1931217],[54.4564447,10.1920893],
  [54.457445,10.1894235],[54.4608848,10.1829868],[54.4651725,10.1765489],[54.4674221,10.1732329],
  [54.4694971,10.1696162],[54.4733971,10.1619526],[54.4755295,10.1570833],[54.4788583,10.1473206],
  [54.4822617,10.1396597],[54.483689,10.1356142],[54.4849665,10.1306243],[54.4851167,10.1195778],
  [54.4845931,10.1135826],[54.48377,10.107845],[54.4806744,10.0843815],[54.4803735,10.0770999],
  [54.480267,10.0741851],[54.4806093,10.0727295],[54.4801968,10.0720498],[54.4803209,10.069178],
  [54.4802206,10.0682803],[54.4796714,10.0663527],[54.4793716,10.0642534],[54.4787219,10.0614282],
  [54.4782717,10.0583456],[54.4778697,10.0523949],[54.4771434,10.0467877],[54.4768618,10.0371185],
  [54.4763895,10.0358777],[54.4758673,10.0321479],[54.4756442,10.0286327],[54.4756704,10.0245167],
  [54.4750768,10.0191252],[54.4740388,10.0149514],[54.4739809,10.0122748],[54.4732746,10.0098128],
  [54.4685696,9.9967791],[54.4680793,9.9891329],[54.4683867,9.9847911],[54.4678959,9.9800202],
  [54.4679535,9.9742194],[54.4671858,9.9662084],[54.4668315,9.9627037],[54.4661778,9.9590274],
  [54.4641217,9.9514177],[54.4629516,9.9395894],[54.4625456,9.9358177],[54.4622892,9.9313165],
  [54.4620006,9.9297084],[54.4619614,9.9281003],[54.4619971,9.9269214],[54.4622821,9.9259142],
  [54.4621253,9.9242884],[54.4615684,9.9233455],[54.4603629,9.9230035],[54.4592198,9.9230692],
  [54.4582014,9.9224054],[54.4547764,9.9193212],[54.4522992,9.9134911],[54.4516181,9.9068031],
  [54.4438395,9.8985438],[54.4334104,9.8809796],[54.4270724,9.8618795],[54.4301671,9.8464348],
  [54.4365519,9.8236137],[54.4469457,9.7571848],[54.4488303,9.7343497],[54.4525848,9.6881769],
  [54.4543193,9.6669726],[54.4571135,9.6330695],[54.4603367,9.6060825],[54.4677457,9.584239],
  [54.4685667,9.5685721],[54.4744731,9.5438056],[54.4785732,9.5370342],[54.4889039,9.5245454],
  [54.4998331,9.515488],[54.5165076,9.5163414],[54.5321856,9.5235495],[54.5370472,9.5567597],
  [54.5466817,9.5838008],[54.5362692,9.6004539],[54.5320756,9.6324887],[54.5294736,9.6975959],
  [54.5231833,9.7086871],[54.524222,9.7193813],[54.5224704,9.7273286],[54.5127896,9.7593345],
  [54.5028911,9.8013835],[54.5069776,9.8339133],[54.5066413,9.8446241],[54.5036884,9.8526245],
  [54.4734756,9.8696189],[54.5009148,9.9600596],[54.5048025,9.9693264],[54.5104838,9.9758484],
  [54.5126763,9.9844325],[54.5170606,9.9904417],[54.518854,9.9939617],[54.5230383,9.9991984],
  [54.5435708,10.0137343],[54.5756901,9.9619727],[54.6220305,9.7750335],[54.6349487,9.6346145],
  [54.6087211,9.5743208],[54.5884241,9.4929938],
];

const ZONE3_NORTH_COORDS: [number, number][] = [
  [54.6741569,9.9754539],[54.6752403,9.9593653],[54.6743917,9.9499474],[54.6735427,9.947739],
  [54.6725287,9.9437125],[54.6723554,9.9399365],[54.6697999,9.9371905],[54.6722329,9.9282658],
  [54.6767007,9.9200286],[54.6777933,9.9088706],[54.6763049,9.9011461],[54.6765779,9.887241],
  [54.6782395,9.8760821],[54.6793773,9.8589145],[54.6811102,9.8388214],[54.6824442,9.8235335],
  [54.6851905,9.807799],[54.6879345,9.7872554],[54.6902453,9.7743182],[54.6919587,9.7648128],
  [54.6916868,9.7532471],[54.69191,9.7480322],[54.6913392,9.7441907],[54.6890067,9.7365082],
  [54.6864234,9.7263338],[54.6814585,9.7195942],[54.6786729,9.7074904],[54.6815078,9.6939231],
  [54.6865241,9.6779542],[54.688021,9.6648989],[54.6840645,9.6442845],[54.6868617,9.6264011],
  [54.6902606,9.6175605],[54.6952469,9.6193624],[54.7004569,9.6099184],[54.7001613,9.5903407],
  [54.6908373,9.5803792],[54.6832967,9.5834649],[54.677591,9.5790833],[54.6746635,9.5637176],
  [54.6735697,9.5398556],[54.6662932,9.5249099],[54.6647732,9.513056],[54.6569662,9.500339],
  [54.6488956,9.4838397],[54.6470507,9.4659537],[54.6421668,9.4549091],[54.6357751,9.4438185],
  [54.6306376,9.436133],[54.6245057,9.4284496],[54.6158185,9.4192663],[54.6069021,9.4119306],
  [54.5983824,9.4076869],[54.590658,9.4031012],[54.5829335,9.4067554],[54.523519,9.411283],
  [54.5884241,9.4929938],[54.6087211,9.5743208],[54.6349487,9.6346145],[54.6220305,9.7750335],
  [54.5756901,9.9619727],[54.5435708,10.0137343],[54.5458603,10.0159652],[54.5461087,10.0171662],
  [54.5465442,10.0202129],[54.5477762,10.0231739],[54.5491077,10.025148],[54.5504392,10.0267789],
  [54.5528281,10.0271228],[54.5707465,10.0260082],[54.5797112,10.0254501],[54.5813133,10.0274671],
  [54.5847757,10.0275316],[54.5868455,10.0258793],[54.5935713,10.0258361],[54.6075442,10.0281524],
  [54.6170925,10.0327888],[54.6219853,10.0336044],[54.6269774,10.0330467],[54.632218,10.0325747],
  [54.6374586,10.0305575],[54.6484365,10.0310719],[54.6548689,10.0328315],[54.6572408,10.0333681],
  [54.6576268,10.0318446],[54.6601966,10.032414],[54.6600853,10.0294643],[54.6581747,10.0249383],
  [54.6595405,10.0165498],[54.6614643,10.013557],[54.6618987,10.0093623],[54.6676815,10.0057795],
  [54.6734643,10.0039126],[54.6739732,10.0027215],[54.6738865,10.0010154],[54.6729064,9.9995668],
  [54.6717277,9.9988049],[54.6704494,9.9978385],[54.6687182,9.9987286],[54.6662922,9.9967006],
  [54.6669122,9.9891037],[54.6690774,9.9897795],[54.6703491,9.9887386],[54.6701626,9.9847685],
];

const ZONE3_SOUTH_COORDS: [number, number][] = [
  [54.3518009,9.6337562],[54.346541,9.6954894],[54.3421039,9.7057504],[54.3386672,9.7130912],
  [54.3451208,9.7445814],[54.3270377,9.8169231],[54.3265557,9.8315669],[54.3183495,9.859378],
  [54.3163461,9.8775733],[54.3175451,9.8889018],[54.2930935,9.9204947],[54.2923049,9.9520732],
  [54.3022767,9.9555131],[54.3069615,9.965989],[54.3073389,9.9783535],[54.2997369,10.0049673],
  [54.3016302,10.038608],[54.2891509,10.0533641],[54.2742666,10.0502636],[54.2698877,10.0743075],
  [54.2779347,10.0911436],[54.2735505,10.1019702],[54.2705683,10.1162278],[54.278035,10.1282437],
  [54.2706408,10.1491018],[54.2678533,10.1744174],[54.2819869,10.1782573],[54.2742194,10.1942569],
  [54.2775743,10.2145434],[54.2854682,10.2083206],[54.280935,10.2285342],[54.2768765,10.2514511],
  [54.2834872,10.2610637],[54.2953093,10.2342841],[54.3075288,10.223128],[54.313238,10.2145446],
  [54.3173448,10.2148867],[54.3247027,10.2209351],[54.3312596,10.2201179],[54.3290008,10.2277985],
  [54.3331478,10.2344493],[54.3409413,10.2355647],[54.3491226,10.217536],[54.3468729,10.2089427],
  [54.3425704,10.1896936],[54.33894,10.1748413],[54.3412168,10.1753568],[54.344169,10.1751857],
  [54.3463711,10.1736644],[54.3479725,10.1747062],[54.3482731,10.1738597],[54.3505222,10.1768203],
  [54.3525722,10.1779144],[54.3547222,10.1774207],[54.3573607,10.1798678],[54.3591988,10.1793967],
  [54.3611709,10.1778071],[54.3625983,10.1819692],[54.3651616,10.194006],[54.3659743,10.1957008],
  [54.3673089,10.1964276],[54.3692435,10.1966823],[54.3725088,10.1943605],[54.3736367,10.1960936],
  [54.3749146,10.1967969],[54.3794505,10.1938138],[54.3802892,10.1980845],[54.3804738,10.1993882],
  [54.3809584,10.2006061],[54.3822274,10.2028704],[54.3845474,10.2045799],[54.3872818,10.2079239],
  [54.3889166,10.2080495],[54.3899871,10.2079789],[54.3914075,10.2090241],[54.40962,10.1889903],
  [54.4203888,10.1785193],[54.4321555,10.1687294],[54.3976002,10.0890063],[54.3826033,10.0560431],
  [54.3715725,10.007241],[54.3625204,9.9234529],[54.3679621,9.8348558],
];

const SCHOOL_COORDS: [number, number] = [54.4936698, 9.6863704];

// ---------------------------------------------------------------------------

const CACHE_KEY = "ll_geocode_cache_v2";
const GEOCODE_DELAY_MS = 1100;

const statusMap: Record<string, string> = {
  received: "Eingegangen",
  reviewed: "Geprüft",
  confirmed: "Bestätigt",
  query_open: "Rückfrage offen",
};

const statusColorMap: Record<string, string> = {
  received: "#3b82f6",
  reviewed: "#f59e0b",
  confirmed: "#22c55e",
  query_open: "#ef4444",
};

const tariffZoneMap: Record<string, string> = {
  zone1: "Tarifzone 1",
  zone2: "Tarifzone 2",
  zone3: "Tarifzone 3",
};

const ZONE_STYLE = {
  zone1: { color: "#b8860b", fillColor: "#FFD600", fillOpacity: 0.18, weight: 2 },
  zone2: { color: "#2d6a1f", fillColor: "#558B2F", fillOpacity: 0.18, weight: 2 },
  zone3: { color: "#7f1a0a", fillColor: "#A52714", fillOpacity: 0.18, weight: 2 },
};

function loadCache(): Record<string, [number, number] | null> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function saveCache(cache: Record<string, [number, number] | null>) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {}
}

async function geocodeAddress(address: string): Promise<[number, number] | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=de`;
    const res = await fetch(url, {
      headers: { "Accept-Language": "de", "User-Agent": "LouisenlundShuttle/1.0" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.length) return null;
    return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
  } catch {
    return null;
  }
}

function createColoredIcon(color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="25" height="41" viewBox="0 0 25 41">
    <path d="M12.5 0C5.6 0 0 5.6 0 12.5C0 21.9 12.5 41 12.5 41C12.5 41 25 21.9 25 12.5C25 5.6 19.4 0 12.5 0Z" fill="${color}" stroke="white" stroke-width="1.5"/>
    <circle cx="12.5" cy="12.5" r="5" fill="white"/>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: "",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [0, -38],
  });
}

function createSchoolIcon() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30">
    <circle cx="15" cy="15" r="13" fill="#004289" stroke="white" stroke-width="2"/>
    <text x="15" y="20" text-anchor="middle" font-size="14" fill="white" font-family="sans-serif" font-weight="bold">S</text>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: "",
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -18],
  });
}

type GeocodedBooking = {
  id: number;
  referenceNumber: string;
  childName: string;
  childAddress: string;
  gradeYear: string;
  parentName: string;
  tariffZone: string;
  status: string;
  coords: [number, number];
};

function FitBounds({ markers }: { markers: GeocodedBooking[] }) {
  const map = useMap();
  useEffect(() => {
    if (markers.length === 0) return;
    const bounds = L.latLngBounds(markers.map((m) => m.coords));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
  }, [markers.length]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export default function AdminMap() {
  const { data, isLoading } = useListAdminBookings({ limit: 1000 });

  const [markers, setMarkers] = useState<GeocodedBooking[]>([]);
  const [geocodedCount, setGeocodedCount] = useState(0);
  const [totalToGeocode, setTotalToGeocode] = useState(0);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [failedCount, setFailedCount] = useState(0);
  const [showZones, setShowZones] = useState(true);

  useEffect(() => {
    if (!data?.bookings) return;

    const bookings = data.bookings;
    const cache = loadCache();
    const initial: GeocodedBooking[] = [];
    const needsGeocode: typeof bookings = [];

    for (const b of bookings) {
      const cached = cache[b.childAddress];
      if (cached !== undefined) {
        if (cached) {
          initial.push({ id: b.id, referenceNumber: b.referenceNumber, childName: b.childName, childAddress: b.childAddress, gradeYear: b.gradeYear, parentName: b.parentName, tariffZone: b.tariffZone, status: b.status, coords: cached });
        }
      } else {
        needsGeocode.push(b);
      }
    }

    setMarkers(initial);

    if (needsGeocode.length === 0) return;

    setTotalToGeocode(needsGeocode.length);
    setGeocodedCount(0);
    setFailedCount(0);
    setIsGeocoding(true);

    let i = 0;
    let active = true;

    function processNext() {
      if (!active || i >= needsGeocode.length) {
        if (active) setIsGeocoding(false);
        return;
      }

      const booking = needsGeocode[i++];

      geocodeAddress(booking.childAddress).then((coords) => {
        cache[booking.childAddress] = coords;
        saveCache(cache);

        if (coords) {
          setMarkers((prev) => [
            ...prev,
            { id: booking.id, referenceNumber: booking.referenceNumber, childName: booking.childName, childAddress: booking.childAddress, gradeYear: booking.gradeYear, parentName: booking.parentName, tariffZone: booking.tariffZone, status: booking.status, coords },
          ]);
        } else {
          setFailedCount((n) => n + 1);
        }

        setGeocodedCount((n) => n + 1);
        setTimeout(processNext, GEOCODE_DELAY_MS);
      });
    }

    processNext();

    return () => { active = false; };
  }, [data]);

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="text-2xl font-serif font-semibold text-primary">Karte der Anmeldungen</h1>
          {!isLoading && data && (
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {data.total} Buchungen gesamt
              </span>
              {isGeocoding && (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Adressen werden geladen … {geocodedCount}/{totalToGeocode}
                </span>
              )}
              {!isGeocoding && failedCount > 0 && (
                <span className="flex items-center gap-1.5 text-amber-600">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {failedCount} Adresse{failedCount !== 1 ? "n" : ""} nicht gefunden
                </span>
              )}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex gap-5 flex-wrap text-sm items-center">
          <span className="font-medium text-muted-foreground">Buchungsstatus:</span>
          {Object.entries(statusMap).map(([key, label]) => (
            <div key={key} className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full inline-block border border-white shadow-sm" style={{ backgroundColor: statusColorMap[key] }} />
              {label}
            </div>
          ))}
          <span className="border-l pl-4 font-medium text-muted-foreground">Tarifzonen:</span>
          {[
            { label: "Zone 1", fill: "#FFD600", border: "#b8860b" },
            { label: "Zone 2", fill: "#558B2F", border: "#2d6a1f" },
            { label: "Zone 3", fill: "#A52714", border: "#7f1a0a" },
          ].map(({ label, fill, border }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className="w-4 h-3 inline-block rounded-sm opacity-80" style={{ backgroundColor: fill, border: `1.5px solid ${border}` }} />
              {label}
            </div>
          ))}
          <button
            onClick={() => setShowZones((v) => !v)}
            className="ml-1 text-xs text-primary underline underline-offset-2 hover:opacity-70"
          >
            {showZones ? "Zonen ausblenden" : "Zonen einblenden"}
          </button>
        </div>

        <Card className="overflow-hidden">
          <CardContent className="p-0" style={{ height: 580 }}>
            {isLoading ? (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                Buchungen werden geladen …
              </div>
            ) : (
              <MapContainer
                center={[54.52, 9.8]}
                zoom={10}
                style={{ height: "100%", width: "100%" }}
                scrollWheelZoom
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* Tariff zone polygons */}
                {showZones && (
                  <>
                    <Polygon positions={ZONE1_COORDS} pathOptions={ZONE_STYLE.zone1}>
                      <Tooltip sticky>Tarifzone 1</Tooltip>
                    </Polygon>
                    <Polygon positions={ZONE2_COORDS} pathOptions={ZONE_STYLE.zone2}>
                      <Tooltip sticky>Tarifzone 2</Tooltip>
                    </Polygon>
                    <Polygon positions={ZONE3_NORTH_COORDS} pathOptions={ZONE_STYLE.zone3}>
                      <Tooltip sticky>Tarifzone 3</Tooltip>
                    </Polygon>
                    <Polygon positions={ZONE3_SOUTH_COORDS} pathOptions={ZONE_STYLE.zone3}>
                      <Tooltip sticky>Tarifzone 3</Tooltip>
                    </Polygon>
                  </>
                )}

                {/* School marker */}
                <Marker position={SCHOOL_COORDS} icon={createSchoolIcon()}>
                  <Popup>
                    <div style={{ fontFamily: "sans-serif", fontSize: 13 }}>
                      <div style={{ fontWeight: 700, color: "#004289" }}>Stiftung Louisenlund</div>
                      <div style={{ color: "#888", fontSize: 11 }}>Louisenlund 9 · 24357 Güby</div>
                    </div>
                  </Popup>
                </Marker>

                <FitBounds markers={markers} />

                {markers.map((m) => (
                  <Marker key={m.id} position={m.coords} icon={createColoredIcon(statusColorMap[m.status] ?? "#6b7280")}>
                    <Popup>
                      <div style={{ minWidth: 190, fontFamily: "sans-serif", fontSize: 13 }}>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>{m.childName}</div>
                        <div style={{ color: "#888", fontSize: 11, marginBottom: 6 }}>{m.referenceNumber}</div>
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                          <tbody>
                            <tr>
                              <td style={{ color: "#888", padding: "2px 6px 2px 0" }}>Klasse</td>
                              <td>{m.gradeYear}</td>
                            </tr>
                            <tr>
                              <td style={{ color: "#888", padding: "2px 6px 2px 0" }}>Elternteil</td>
                              <td>{m.parentName}</td>
                            </tr>
                            <tr>
                              <td style={{ color: "#888", padding: "2px 6px 2px 0" }}>Zone</td>
                              <td>{tariffZoneMap[m.tariffZone] ?? m.tariffZone}</td>
                            </tr>
                            <tr>
                              <td style={{ color: "#888", padding: "2px 6px 2px 0" }}>Status</td>
                              <td>
                                <span style={{ color: statusColorMap[m.status], fontWeight: 600 }}>
                                  {statusMap[m.status] ?? m.status}
                                </span>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                        <div style={{ marginTop: 8 }}>
                          <a href={`/admin/bookings/${m.id}`} style={{ color: "#004289", fontSize: 12 }}>
                            Details öffnen →
                          </a>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            )}
          </CardContent>
        </Card>

        {isGeocoding && totalToGeocode > 0 && (
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-[#004289] h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${(geocodedCount / totalToGeocode) * 100}%` }}
            />
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
