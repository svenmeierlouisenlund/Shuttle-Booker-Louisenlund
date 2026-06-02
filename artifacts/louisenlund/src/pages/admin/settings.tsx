import { useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import {
  useListNotificationEmails,
  useAddNotificationEmail,
  useDeleteNotificationEmail,
  useGetSmtpConfig,
  useUpdateSmtpConfig,
  useTestSmtpConfig,
  getGetSmtpConfigQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus, Mail, Loader2, CheckCircle2, AlertCircle, Eye, EyeOff, Send, Server } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getListNotificationEmailsQueryKey } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";

export default function AdminSettings() {
  const { data, isLoading } = useListNotificationEmails();
  const addEmail = useAddNotificationEmail();
  const deleteEmail = useDeleteNotificationEmail();
  const { data: smtpData, isLoading: smtpLoading } = useGetSmtpConfig();
  const updateSmtp = useUpdateSmtpConfig();
  const testSmtp = useTestSmtpConfig();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [newEmail, setNewEmail] = useState("");
  const [newLabel, setNewLabel] = useState("");

  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpFrom, setSmtpFrom] = useState("");
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [smtpLoaded, setSmtpLoaded] = useState(false);
  const [testEmail, setTestEmail] = useState("");

  if (smtpData && !smtpLoaded) {
    setSmtpHost(smtpData.host);
    setSmtpPort(String(smtpData.port));
    setSmtpUser(smtpData.user);
    setSmtpFrom(smtpData.fromAddress);
    setSmtpSecure(smtpData.secure);
    setSmtpLoaded(true);
  }

  const handleAdd = async () => {
    if (!newEmail.trim()) return;
    try {
      await addEmail.mutateAsync({ data: { email: newEmail.trim(), label: newLabel.trim() || null } });
      await queryClient.invalidateQueries({ queryKey: getListNotificationEmailsQueryKey() });
      setNewEmail("");
      setNewLabel("");
      toast({ title: "E-Mail-Adresse hinzugefügt", description: newEmail.trim() });
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? "Fehler beim Hinzufügen";
      toast({ title: "Fehler", description: msg, variant: "destructive" });
    }
  };

  const handleDelete = async (id: number, email: string) => {
    try {
      await deleteEmail.mutateAsync({ id });
      await queryClient.invalidateQueries({ queryKey: getListNotificationEmailsQueryKey() });
      toast({ title: "E-Mail-Adresse entfernt", description: email });
    } catch {
      toast({ title: "Fehler", description: "Konnte nicht gelöscht werden", variant: "destructive" });
    }
  };

  const handleSmtpSave = async () => {
    try {
      const result = await updateSmtp.mutateAsync({
        data: {
          host: smtpHost,
          port: parseInt(smtpPort, 10) || 587,
          user: smtpUser,
          ...(smtpPass ? { pass: smtpPass } : {}),
          fromAddress: smtpFrom,
          secure: smtpSecure,
        }
      });
      queryClient.setQueryData(getGetSmtpConfigQueryKey(), result);
      setSmtpPass("");
      toast({ title: "SMTP-Konfiguration gespeichert" });
    } catch {
      toast({ title: "Fehler", description: "Konfiguration konnte nicht gespeichert werden.", variant: "destructive" });
    }
  };

  const handleSmtpTest = async () => {
    if (!testEmail.trim()) return;
    try {
      const result = await testSmtp.mutateAsync({ data: { to: testEmail.trim() } });
      if (result.success) {
        toast({ title: "Test-E-Mail gesendet", description: `E-Mail wurde erfolgreich an ${testEmail} gesendet.` });
      } else {
        toast({ title: "Fehler beim Senden", description: result.error ?? "Unbekannter Fehler", variant: "destructive" });
      }
    } catch {
      toast({ title: "Fehler", description: "Test konnte nicht durchgeführt werden.", variant: "destructive" });
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-8 max-w-2xl">
        <h1 className="text-2xl font-serif font-semibold text-primary">Einstellungen</h1>

        {/* SMTP Config */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Server className="w-4 h-4 text-primary" />
                SMTP-Konfiguration
              </CardTitle>
              {!smtpLoading && smtpData && (
                <Badge variant="outline" className={smtpData.configured
                  ? "bg-green-50 text-green-700 border-green-200"
                  : "bg-amber-50 text-amber-700 border-amber-200"
                }>
                  {smtpData.configured ? (
                    <><CheckCircle2 className="w-3 h-3 mr-1" />Konfiguriert</>
                  ) : (
                    <><AlertCircle className="w-3 h-3 mr-1" />Nicht konfiguriert</>
                  )}
                </Badge>
              )}
            </div>
            <CardDescription>
              Zugangsdaten für den ausgehenden E-Mail-Server. Das Passwort wird verschlüsselt gespeichert und nicht angezeigt.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {smtpLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
                <Loader2 className="w-4 h-4 animate-spin" />Wird geladen…
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex items-center gap-2 pb-1">
                  <span className="text-sm text-muted-foreground">Schnellkonfiguration:</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs px-3"
                    onClick={() => {
                      setSmtpHost("smtp.office365.com");
                      setSmtpPort("587");
                      setSmtpSecure(false);
                    }}
                  >
                    Microsoft 365 / Outlook
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label htmlFor="smtp-host">SMTP-Host</Label>
                    <Input id="smtp-host" placeholder="smtp.office365.com" value={smtpHost} onChange={e => setSmtpHost(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="smtp-port">Port</Label>
                    <Input id="smtp-port" type="number" placeholder="587" value={smtpPort} onChange={e => setSmtpPort(e.target.value)} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="smtp-user">Benutzername</Label>
                    <Input id="smtp-user" placeholder="user@beispiel.de" value={smtpUser} onChange={e => setSmtpUser(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="smtp-pass">Passwort</Label>
                    <div className="relative">
                      <Input
                        id="smtp-pass"
                        type={showPass ? "text" : "password"}
                        placeholder={smtpData?.configured ? "••••••••  (unverändert)" : "Passwort eingeben"}
                        value={smtpPass}
                        onChange={e => setSmtpPass(e.target.value)}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass(v => !v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="smtp-from">Absenderadresse</Label>
                  <Input id="smtp-from" type="email" placeholder="noreply@louisenlund.de" value={smtpFrom} onChange={e => setSmtpFrom(e.target.value)} />
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <Switch id="smtp-secure" checked={smtpSecure} onCheckedChange={setSmtpSecure} />
                  <div>
                    <Label htmlFor="smtp-secure" className="cursor-pointer">
                      SSL/TLS direkt verwenden (Port 465)
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Deaktiviert für Microsoft 365 / STARTTLS (Port 587)
                    </p>
                  </div>
                </div>

                <Button onClick={handleSmtpSave} disabled={updateSmtp.isPending} className="w-full sm:w-auto">
                  {updateSmtp.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Konfiguration speichern
                </Button>

                {smtpData?.configured && (
                  <div className="border-t pt-4 space-y-3">
                    <Label className="text-sm font-medium">Test-E-Mail senden</Label>
                    <div className="flex gap-2">
                      <Input
                        type="email"
                        placeholder="empfaenger@beispiel.de"
                        value={testEmail}
                        onChange={e => setTestEmail(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleSmtpTest()}
                        className="flex-1"
                      />
                      <Button variant="outline" onClick={handleSmtpTest} disabled={!testEmail.trim() || testSmtp.isPending}>
                        {testSmtp.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        <span className="ml-2 hidden sm:inline">Senden</span>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notification Emails */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="w-4 h-4 text-primary" />
              E-Mail-Benachrichtigungen
            </CardTitle>
            <CardDescription>
              Bei jeder neuen Anmeldung wird eine automatische E-Mail an diese Adressen versandt.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Empfängeradressen</Label>
              {isLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Wird geladen…
                </div>
              ) : data?.emails.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  Noch keine Empfängeradressen eingetragen.
                </p>
              ) : (
                <ul className="space-y-2">
                  {data?.emails.map((e) => (
                    <li
                      key={e.id}
                      className="flex items-center justify-between gap-3 bg-muted/40 border rounded-md px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{e.email}</p>
                        {e.label && (
                          <p className="text-xs text-muted-foreground truncate">{e.label}</p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:bg-destructive/10 shrink-0"
                        onClick={() => handleDelete(e.id, e.email)}
                        disabled={deleteEmail.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border-t pt-4 space-y-3">
              <Label className="text-sm font-medium">Neue Adresse hinzufügen</Label>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  type="email"
                  placeholder="name@beispiel.de"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                  className="flex-1"
                />
                <Input
                  type="text"
                  placeholder="Bezeichnung (optional)"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                  className="flex-1"
                />
                <Button
                  onClick={handleAdd}
                  disabled={!newEmail.trim() || addEmail.isPending}
                  className="bg-primary hover:bg-primary/90"
                >
                  {addEmail.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  <span className="ml-1">Hinzufügen</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
