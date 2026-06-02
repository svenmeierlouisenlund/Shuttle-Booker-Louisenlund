import { Link } from "wouter";

export default function Impressum() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Header */}
      <header className="bg-[#004289] text-white">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/">
            <img src="/logo.png" alt="Louisenlund" className="h-12 cursor-pointer" />
          </Link>
          <span className="text-sm font-semibold tracking-widest uppercase">
            Buchungsportal Regionalshuttle
          </span>
        </div>
        <div className="h-1 bg-[#e30613]" />
      </header>

      <main className="flex-1 max-w-3xl mx-auto px-6 py-12 w-full">
        <h1 className="text-3xl font-bold text-[#004289] mb-8">Impressum</h1>

        <section className="space-y-6 text-sm text-gray-700 leading-relaxed">

          <div>
            <h2 className="font-semibold text-[#004289] text-base mb-2">Herausgeber</h2>
            <p>
              Stiftung Louisenlund<br />
              Vertreten durch<br />
              Kuratoriumsvorsitzende und Vorstandsvorsitzende<br />
              Ingeborg Prinzessin zu Schleswig-Holstein<br />
              Louisenlund 9<br />
              24357 Güby
            </p>
            <p className="mt-3">
              Grundschule Louisenlund gGmbH<br />
              HRB 16831 KI<br />
              Louisenlund 9<br />
              24357 Güby
            </p>
          </div>

          <div>
            <h2 className="font-semibold text-[#004289] text-base mb-2">Kontaktinformation</h2>
            <p>
              Stiftung Louisenlund<br />
              Louisenlund 9<br />
              24357 Güby<br />
              T +49 4354 999-0<br />
              F +49 4354 999-171
            </p>
          </div>

          <div>
            <h2 className="font-semibold text-[#004289] text-base mb-2">Zuständige Aufsichtsbehörde</h2>
            <p>
              Ministerium für Bildung, Wissenschaft und Kultur<br />
              Jensendamm 5<br />
              24103 Kiel
            </p>
          </div>

          <div>
            <h2 className="font-semibold text-[#004289] text-base mb-2">Rechtliche Hinweise</h2>
            <h3 className="font-semibold mb-1">Erklärung zur Linksetzung</h3>
            <p>
              Die Stiftung Louisenlund erklärt ausdrücklich, dass zum Zeitpunkt einer Linksetzung
              die entsprechenden verlinkten Seiten frei von illegalen Inhalten waren. Der Herausgeber
              hat keinerlei Einfluss auf die aktuelle und zukünftige Gestaltung und auf die Inhalte
              der verknüpften Seiten. Deshalb distanziert er sich hiermit ausdrücklich von allen
              Inhalten aller gelinkten Seiten, die nach der Linksetzung verändert wurden.
            </p>
          </div>

          <div>
            <h2 className="font-semibold text-[#004289] text-base mb-2">Inhalte</h2>
            <p>
              Die Inhalte der Internetseiten werden sorgfältig geprüft und nach bestem Wissen
              erstellt. Jedoch kann keinerlei Gewähr für die Korrektheit, Vollständigkeit,
              Aktualität oder Qualität der bereitgestellten Informationen übernommen werden.
              Haftungsansprüche gegen die Stiftung Louisenlund, welche sich auf Schäden materieller
              oder ideeller Art beziehen, die durch die Nutzung oder Nichtnutzung der dargebotenen
              Informationen bzw. durch die Nutzung fehlerhafter und unvollständiger Informationen
              verursacht wurden, sind grundsätzlich ausgeschlossen, sofern auf Seiten der Stiftung
              Louisenlund kein nachweislich vorsätzliches oder grob fahrlässiges Verschulden
              vorliegt. Namentlich gekennzeichnete Beiträge spiegeln nicht unbedingt die Meinung
              des Herausgebers wider.
            </p>
          </div>

          <div>
            <h2 className="font-semibold text-[#004289] text-base mb-2">Urheberrechtliche Hinweise</h2>
            <p>
              Die Stiftung Louisenlund ist bestrebt, in allen Publikationen die Urheberrechte der
              verwendeten Grafiken, Tondokumente, Videosequenzen und Texte zu beachten, von ihr
              selbst erstellte Grafiken, Tondokumente, Videosequenzen und Texte zu nutzen oder auf
              lizenzfreie Grafiken, Tondokumente, Videosequenzen und Texte zurückzugreifen. Alle
              innerhalb des Internetangebotes genannten und ggf. durch Dritte geschützten Marken-
              und Warenzeichen unterliegen uneingeschränkt den Bestimmungen des jeweils gültigen
              Kennzeichenrechts und den Besitzrechten der jeweiligen eingetragenen Eigentümer. Das
              Copyright für veröffentlichte, selbst erstellte Objekte bleibt allein bei der
              Stiftung Louisenlund. Eine Vervielfältigung oder Verwendung der Grafiken,
              Tondokumente, Videosequenzen und Texte in anderen elektronischen oder gedruckten
              Publikationen ist ohne ausdrückliche Zustimmung nicht gestattet.
            </p>
          </div>

        </section>

        <div className="mt-10">
          <Link href="/" className="text-sm text-[#004289] hover:underline">
            ← Zurück zur Startseite
          </Link>
        </div>
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
