import { useState } from "react";
import { useLocation, Redirect } from "wouter";
import { useGetAdminMe, useChangeAdminPassword, getGetAdminMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, KeyRound, AlertTriangle, CheckCircle2, ArrowRight } from "lucide-react";
import logo from "@assets/Logo_-_Stiftung_Louisenlund_Print_1780387424925.png";

export default function ChangePassword() {
  const { data: me, isLoading } = useGetAdminMe();
  const changePassword = useChangeAdminPassword();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-[#004289]" />
      </div>
    );
  }

  if (!me?.authenticated) {
    return <Redirect to="/admin/login" />;
  }

  const isMandatory = !!me.mustChangePassword;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError("Das neue Passwort muss mindestens 8 Zeichen lang sein.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Die Passwörter stimmen nicht überein.");
      return;
    }

    changePassword.mutate(
      { data: { currentPassword, newPassword } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetAdminMeQueryKey() });
          if (isMandatory) {
            setSuccess(true);
          } else {
            toast({ title: "Passwort geändert", description: "Ihr Passwort wurde erfolgreich aktualisiert." });
            navigate("/admin");
          }
        },
        onError: (err: unknown) => {
          const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
          setError(msg ?? "Fehler beim Ändern des Passworts.");
        },
      }
    );
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[#f0f0f0]">
      <header className="ll-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-0 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-white rounded px-2 py-0.5">
              <img src={logo} alt="Stiftung Louisenlund" className="h-8 w-auto" />
            </div>
            <span className="text-blue-100 text-sm font-medium">Passwort ändern</span>
          </div>
          {!isMandatory && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/admin")}
              className="border-white/30 text-white hover:bg-white hover:text-[#004289] text-xs"
            >
              Abbrechen
            </Button>
          )}
        </div>
        <div className="ll-accent-bar" />
      </header>

      <main className="flex-1 flex items-start justify-center pt-16 px-4">
        {success ? (
          <Card className="w-full max-w-md shadow-lg">
            <CardContent className="pt-8 pb-8 flex flex-col items-center text-center gap-5">
              <div className="w-16 h-16 rounded-full bg-green-50 border-2 border-green-200 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-xl font-semibold text-gray-900">Passwort erfolgreich geändert</h2>
                <p className="text-sm text-muted-foreground">
                  Ihr neues Passwort ist ab sofort aktiv. Sie können sich jetzt am Administrationsbereich anmelden.
                </p>
              </div>
              <Button
                className="bg-[#004289] hover:bg-[#003070] gap-2 mt-2"
                onClick={() => navigate("/admin")}
              >
                Zum Dashboard
                <ArrowRight className="w-4 h-4" />
              </Button>
            </CardContent>
          </Card>
        ) : (
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-[#004289]" />
              <CardTitle className="text-xl">Passwort ändern</CardTitle>
            </div>
            {isMandatory ? (
              <CardDescription className="flex items-start gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3 mt-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  Für Ihr Konto wurde ein temporäres Passwort vergeben. Bitte setzen Sie jetzt ein persönliches Passwort, um fortzufahren.
                </span>
              </CardDescription>
            ) : (
              <CardDescription>
                Geben Sie Ihr aktuelles Passwort und anschließend ein neues Passwort ein.
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="current-password">Aktuelles Passwort</Label>
                <Input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-password">Neues Passwort</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={8}
                />
                <p className="text-xs text-gray-500">Mindestens 8 Zeichen</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password">Neues Passwort bestätigen</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                className="w-full bg-[#004289] hover:bg-[#003070]"
                disabled={changePassword.isPending}
              >
                {changePassword.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Passwort speichern
              </Button>
            </form>
          </CardContent>
        </Card>
        )}
      </main>
    </div>
  );
}
