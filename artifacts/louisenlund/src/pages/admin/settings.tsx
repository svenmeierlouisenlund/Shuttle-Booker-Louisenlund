import { useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import {
  useListNotificationEmails,
  useAddNotificationEmail,
  useDeleteNotificationEmail,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, Mail, Loader2, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getListNotificationEmailsQueryKey } from "@workspace/api-client-react";

export default function AdminSettings() {
  const { data, isLoading } = useListNotificationEmails();
  const addEmail = useAddNotificationEmail();
  const deleteEmail = useDeleteNotificationEmail();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [newEmail, setNewEmail] = useState("");
  const [newLabel, setNewLabel] = useState("");

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

  const smtpConfigured = true;

  return (
    <AdminLayout>
      <div className="space-y-8 max-w-2xl">
        <h1 className="text-2xl font-serif font-semibold text-primary">Einstellungen</h1>

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
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3 flex gap-2 text-sm text-blue-800">
              <Info className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium mb-1">SMTP-Konfiguration erforderlich</p>
                <p>Damit E-Mails versandt werden, müssen folgende Umgebungsvariablen gesetzt sein:</p>
                <ul className="mt-1 space-y-0.5 font-mono text-xs">
                  <li><span className="font-bold">SMTP_HOST</span> — z.B. mail.louisenlund.de</li>
                  <li><span className="font-bold">SMTP_PORT</span> — z.B. 587 (Standard)</li>
                  <li><span className="font-bold">SMTP_USER</span> — SMTP-Benutzername</li>
                  <li><span className="font-bold">SMTP_PASS</span> — SMTP-Passwort</li>
                  <li><span className="font-bold">SMTP_FROM</span> — Absenderadresse (optional)</li>
                  <li><span className="font-bold">SMTP_SECURE</span> — true für SSL/Port 465 (optional)</li>
                </ul>
              </div>
            </div>

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
