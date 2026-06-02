import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-2xl w-full space-y-8">
        <div className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight text-primary">
            Regionalshuttle Louisenlund
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Willkommen im Buchungsportal für den Regionalshuttle der Stiftung Louisenlund für das Schuljahr 2026/27. 
            In Partnerschaft mit der MediCall Fahrdienst GmbH bieten wir einen zuverlässigen Transport für unsere Schülerinnen und Schüler.
          </p>
          <p className="text-sm text-muted-foreground bg-secondary/50 p-4 rounded-md border border-secondary-border">
            Bitte beachten Sie: Die Kapazitäten werden regelmäßig überprüft und bei Bedarf erweitert, 
            um allen Anfragen gerecht zu werden.
          </p>
        </div>
        
        <div className="pt-8">
          <Link href="/booking" className="inline-block">
            <Button size="lg" className="text-lg px-8 py-6 rounded-md shadow-sm">
              Buchung starten
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}