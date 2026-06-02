import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, MapPin, Clock, Users } from "lucide-react";
import logo from "@assets/Logo_-_Stiftung_Louisenlund_Print_1780387424925.png";

export default function Home() {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-white">
      {/* Header */}
      <header className="ll-header">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white rounded px-2 py-1">
              <img src={logo} alt="Stiftung Louisenlund" className="h-9 w-auto" />
            </div>
            <div className="text-blue-200 text-xs tracking-widest uppercase hidden sm:block">
              Internat · Ganztagsgymnasium · IB World School
            </div>
          </div>
        </div>
        <div className="ll-accent-bar" />
      </header>

      {/* Hero */}
      <main className="flex-1">
        <section className="max-w-5xl mx-auto px-6 py-16 md:py-24">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold tracking-widest uppercase text-[#ce1329] mb-4">
              Schuljahr 2026/27
            </p>
            <h1 className="text-4xl md:text-5xl font-semibold text-[#004289] leading-tight mb-6">
              Buchungsportal<br />Regionalshuttle
            </h1>
            <p className="text-lg text-[#333333] leading-relaxed mb-4">
              Die Stiftung Louisenlund bietet in Zusammenarbeit mit der{" "}
              <strong className="font-semibold">MediCall Fahrdienst GmbH</strong> einen
              zuverlässigen Regionalshuttle für Schülerinnen und Schüler an.
            </p>
            <p className="text-base text-[#666666] leading-relaxed mb-10">
              Nutzen Sie dieses Portal, um Ihren Platz für das Schuljahr 2026/27 verbindlich
              zu buchen. Die Buchung erfolgt in wenigen Schritten.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/booking">
                <Button
                  size="lg"
                  className="bg-[#004289] hover:bg-[#003070] text-white font-semibold px-8 py-3 text-base"
                  data-testid="button-start-booking"
                >
                  Buchung starten
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <a
                href="https://www.louisenlund.de/regionalshuttle"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  variant="outline"
                  size="lg"
                  className="border-[#004289] text-[#004289] hover:bg-[#004289] hover:text-white font-semibold px-8 py-3 text-base"
                >
                  Tarifzonen & Informationen
                </Button>
              </a>
            </div>
          </div>
        </section>

        {/* Info cards */}
        <section className="bg-[#f0f0f0] border-t border-gray-200">
          <div className="max-w-5xl mx-auto px-6 py-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white border border-gray-200 p-6">
                <div className="w-8 h-8 flex items-center justify-center bg-[#004289] mb-4">
                  <MapPin className="w-4 h-4 text-white" />
                </div>
                <h3 className="font-semibold text-[#004289] mb-2">Drei Tarifzonen</h3>
                <p className="text-sm text-[#666666] leading-relaxed">
                  Wählen Sie Tarifzone 1, 2 oder 3 entsprechend Ihrem Wohnort.
                  Details finden Sie auf{" "}
                  <a
                    href="https://www.louisenlund.de/regionalshuttle"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#004289] underline underline-offset-2"
                  >
                    www.louisenlund.de/regionalshuttle
                  </a>
                  .
                </p>
              </div>

              <div className="bg-white border border-gray-200 p-6">
                <div className="w-8 h-8 flex items-center justify-center bg-[#004289] mb-4">
                  <Clock className="w-4 h-4 text-white" />
                </div>
                <h3 className="font-semibold text-[#004289] mb-2">Flexible Buchung</h3>
                <p className="text-sm text-[#666666] leading-relaxed">
                  Buchen Sie das gesamte Schuljahr 2026/27 oder nur das erste Schulhalbjahr.
                  Rückfahrten um 14:30 Uhr oder 16:30 Uhr.
                </p>
              </div>

              <div className="bg-white border border-gray-200 p-6">
                <div className="w-8 h-8 flex items-center justify-center bg-[#004289] mb-4">
                  <Users className="w-4 h-4 text-white" />
                </div>
                <h3 className="font-semibold text-[#004289] mb-2">Geschwisterkinder</h3>
                <p className="text-sm text-[#666666] leading-relaxed">
                  Bis zu 3 Geschwisterkinder können gemeinsam angemeldet werden.
                  Geschwisterkinder erhalten 20% Ermäßigung auf den Halbjahres- bzw. Jahrespreis.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Notice */}
        <section className="max-w-5xl mx-auto px-6 py-10">
          <div className="border-l-4 border-[#ce1329] bg-white pl-5 py-3">
            <p className="text-sm text-[#333333] leading-relaxed">
              <strong className="font-semibold">Hinweis zu Kapazitäten:</strong>{" "}
              Die Kapazitäten des Regionalshuttles werden regelmäßig überprüft und bei Bedarf
              erweitert, um allen Anfragen gerecht zu werden. Die Abbuchung erfolgt über das Elternkonto.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-[#f0f0f0]">
        <div className="max-w-5xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-[#666666]">
            © {new Date().getFullYear()} Stiftung Louisenlund · D-24357 Güby
          </p>
          <p className="text-xs text-[#666666]">
            Regionalshuttle in Kooperation mit MediCall Fahrdienst GmbH
          </p>
        </div>
      </footer>
    </div>
  );
}
