import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { CheckCircle2 } from "lucide-react";

export default function BookingSuccess() {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-white">
      {/* Header */}
      <header className="ll-header">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="text-white font-semibold text-base tracking-wide">
            Stiftung Louisenlund
          </div>
          <div className="text-blue-200 text-xs tracking-widest uppercase mt-0.5">
            Buchungsportal Regionalshuttle
          </div>
        </div>
        <div className="ll-accent-bar" />
      </header>

      <div className="flex-1 flex items-center justify-center bg-[#f0f0f0] px-4 py-16">
        <div className="bg-white border border-gray-200 shadow-sm max-w-md w-full">
          {/* Top accent */}
          <div className="h-1 bg-[#004289]" />
          <div className="p-8 text-center">
            <div
              className="mx-auto w-14 h-14 flex items-center justify-center mb-6"
              style={{ backgroundColor: "#004289" }}
            >
              <CheckCircle2 className="w-7 h-7 text-white" />
            </div>

            <h1 className="text-2xl font-semibold text-[#004289] mb-3">
              Buchung eingegangen
            </h1>
            <p className="text-[#666666] text-sm leading-relaxed mb-6">
              Vielen Dank für Ihre Buchungsanfrage. Wir haben Ihre Angaben erhalten und
              werden diese schnellstmöglich bearbeiten.
            </p>

            <div className="bg-[#f0f0f0] border border-gray-200 p-4 mb-6 text-left">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#004289] mb-2">
                Nächste Schritte
              </p>
              <ul className="text-sm text-[#333333] space-y-1.5">
                <li className="flex items-start gap-2">
                  <span className="text-[#ce1329] font-bold mt-0.5">·</span>
                  <span>Sie erhalten eine Bestätigungs-E-Mail an die angegebene Adresse.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#ce1329] font-bold mt-0.5">·</span>
                  <span>Die Buchung wird von der Schulverwaltung geprüft und bestätigt.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#ce1329] font-bold mt-0.5">·</span>
                  <span>Die Abbuchung erfolgt über Ihr Elternkonto.</span>
                </li>
              </ul>
            </div>

            <Link href="/">
              <Button
                className="w-full bg-[#004289] hover:bg-[#003070] text-white font-semibold"
                data-testid="button-back-home"
              >
                Zurück zur Startseite
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <footer className="border-t border-gray-200 bg-white">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <p className="text-xs text-[#666666]">
            © {new Date().getFullYear()} Stiftung Louisenlund · D-24357 Güby
          </p>
        </div>
      </footer>
    </div>
  );
}
