import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { CheckCircle2 } from "lucide-react";

export default function BookingSuccess() {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-4 bg-muted/20">
      <Card className="max-w-md w-full shadow-lg border-primary/10">
        <CardHeader className="text-center pt-8">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6">
            <CheckCircle2 className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl text-primary font-serif">Buchung eingegangen</CardTitle>
          <CardDescription className="text-base mt-2">
            Vielen Dank. Ihre Buchungsanfrage wurde erfolgreich übermittelt.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pb-8">
          <div className="bg-muted p-4 rounded-md text-center">
            <p className="text-sm text-muted-foreground mb-1">Eine Bestätigungs-E-Mail wurde gesendet an die angegebene Adresse.</p>
          </div>
          
          <div className="flex justify-center">
            <Link href="/">
              <Button variant="outline" className="w-full sm:w-auto">
                Zurück zur Startseite
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}