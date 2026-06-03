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
  useGetAdminMe,
  useListAdminUsers,
  useCreateAdminUser,
  useUpdateAdminUser,
  useDeleteAdminUser,
  getListAdminUsersQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Trash2, Plus, Mail, Loader2, CheckCircle2, AlertCircle, Eye, EyeOff,
  Send, Server, Users, Pencil, ShieldCheck, Key,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getListNotificationEmailsQueryKey } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";

// ── Role helpers ───────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  buchhaltung: "Buchhaltung",
  schulbuero: "Schulbüro",
  fahrer: "Fahrer",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-[#004289]/10 text-[#004289] border-[#004289]/20",
  buchhaltung: "bg-emerald-50 text-emerald-700 border-emerald-200",
  schulbuero: "bg-violet-50 text-violet-700 border-violet-200",
  fahrer: "bg-amber-50 text-amber-700 border-amber-200",
};

function RoleBadge({ role }: { role: string }) {
  return (
    <Badge variant="outline" className={`text-xs font-medium ${ROLE_COLORS[role] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
      {ROLE_LABELS[role] ?? role}
    </Badge>
  );
}

type Role = "admin" | "buchhaltung" | "schulbuero" | "fahrer";

// ── User management card ───────────────────────────────────────────────────────

function UserManagement({ currentUserId }: { currentUserId?: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: usersData, isLoading: usersLoading } = useListAdminUsers();
  const createUser = useCreateAdminUser();
  const updateUser = useUpdateAdminUser();
  const deleteUser = useDeleteAdminUser();

  const [showAdd, setShowAdd] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<Role>("schulbuero");
  const [showNewPass, setShowNewPass] = useState(false);

  const [editingUser, setEditingUser] = useState<{ id: number; username: string; role: Role } | null>(null);
  const [editRole, setEditRole] = useState<Role>("schulbuero");
  const [editPassword, setEditPassword] = useState("");
  const [showEditPass, setShowEditPass] = useState(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListAdminUsersQueryKey() });

  const handleCreate = async () => {
    if (!newUsername.trim() || !newPassword.trim()) return;
    try {
      await createUser.mutateAsync({ data: { username: newUsername.trim(), password: newPassword.trim(), role: newRole } });
      await invalidate();
      setShowAdd(false);
      setNewUsername(""); setNewPassword(""); setNewRole("schulbuero");
      toast({ title: "Benutzer erstellt", description: newUsername.trim() });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Fehler beim Erstellen";
      toast({ title: "Fehler", description: msg, variant: "destructive" });
    }
  };

  const handleUpdate = async () => {
    if (!editingUser) return;
    try {
      const payload: { role?: Role; password?: string } = { role: editRole };
      if (editPassword.trim()) payload.password = editPassword.trim();
      await updateUser.mutateAsync({ userId: editingUser.id, data: payload });
      await invalidate();
      setEditingUser(null); setEditPassword("");
      toast({ title: "Benutzer aktualisiert" });
    } catch {
      toast({ title: "Fehler", description: "Aktualisierung fehlgeschlagen", variant: "destructive" });
    }
  };

  const handleToggleActive = async (id: number, isActive: boolean) => {
    try {
      await updateUser.mutateAsync({ userId: id, data: { isActive: !isActive } });
      await invalidate();
    } catch {
      toast({ title: "Fehler", description: "Status konnte nicht geändert werden", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteUser.mutateAsync({ userId: id });
      await invalidate();
      setConfirmDeleteId(null);
      toast({ title: "Benutzer gelöscht" });
    } catch {
      toast({ title: "Fehler", description: "Löschen fehlgeschlagen", variant: "destructive" });
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="w-4 h-4 text-primary" />
              Benutzerverwaltung
            </CardTitle>
            <Button
              size="sm"
              onClick={() => setShowAdd(true)}
              className="bg-[#004289] hover:bg-[#003070] gap-1.5 h-8 text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              Benutzer hinzufügen
            </Button>
          </div>
          <CardDescription>
            Verwalten Sie den Zugang zum Administrationsbereich. Nur Admins können Benutzer anlegen, bearbeiten und löschen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {usersLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
              <Loader2 className="w-4 h-4 animate-spin" />Wird geladen…
            </div>
          ) : (
            <div className="space-y-2">
              {usersData?.users.map(u => (
                <div
                  key={u.id}
                  className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 transition-colors
                    ${u.isActive ? "bg-white" : "bg-gray-50 opacity-60"}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-[#004289]/10 flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-4 h-4 text-[#004289]" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-900">{u.username}</span>
                        {u.id === currentUserId && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5 bg-blue-50 text-blue-600 border-blue-200">
                            Ich
                          </Badge>
                        )}
                        {!u.isActive && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5 bg-gray-100 text-gray-500">
                            Deaktiviert
                          </Badge>
                        )}
                      </div>
                      <div className="mt-0.5">
                        <RoleBadge role={u.role} />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-gray-400 hover:text-[#004289]"
                      title="Bearbeiten"
                      onClick={() => {
                        setEditingUser({ id: u.id, username: u.username, role: u.role as Role });
                        setEditRole(u.role as Role);
                        setEditPassword("");
                      }}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <button
                      onClick={() => handleToggleActive(u.id, u.isActive)}
                      title={u.isActive ? "Deaktivieren" : "Aktivieren"}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors
                        ${u.isActive ? "bg-[#004289]" : "bg-gray-300"}
                        ${u.id === currentUserId ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
                      disabled={u.id === currentUserId}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform
                          ${u.isActive ? "translate-x-4" : "translate-x-0.5"}`}
                      />
                    </button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-gray-300 hover:text-red-500 hover:bg-red-50"
                      title="Löschen"
                      onClick={() => setConfirmDeleteId(u.id)}
                      disabled={u.id === currentUserId}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
              {usersData?.users.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Keine Benutzer vorhanden.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add user dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Neuen Benutzer anlegen
            </DialogTitle>
            <DialogDescription>
              Legen Sie einen neuen Benutzer für den Administrationsbereich an.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="new-username">Benutzername</Label>
              <Input
                id="new-username"
                placeholder="z. B. max.mustermann"
                value={newUsername}
                onChange={e => setNewUsername(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-password">Passwort</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPass ? "text" : "password"}
                  placeholder="Sicheres Passwort eingeben"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="pr-10"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPass(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-role">Rolle</Label>
              <Select value={newRole} onValueChange={v => setNewRole(v as Role)}>
                <SelectTrigger id="new-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Abbrechen</Button>
            <Button
              onClick={handleCreate}
              disabled={!newUsername.trim() || !newPassword.trim() || createUser.isPending}
              className="bg-[#004289] hover:bg-[#003070]"
            >
              {createUser.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Benutzer anlegen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit user dialog */}
      <Dialog open={!!editingUser} onOpenChange={open => { if (!open) setEditingUser(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-4 h-4" />
              Benutzer bearbeiten — {editingUser?.username}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-role">Rolle</Label>
              <Select value={editRole} onValueChange={v => setEditRole(v as Role)}>
                <SelectTrigger id="edit-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-password" className="flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5" />
                Neues Passwort
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <div className="relative">
                <Input
                  id="edit-password"
                  type={showEditPass ? "text" : "password"}
                  placeholder="Leer lassen = Passwort unverändert"
                  value={editPassword}
                  onChange={e => setEditPassword(e.target.value)}
                  className="pr-10"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowEditPass(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showEditPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>Abbrechen</Button>
            <Button
              onClick={handleUpdate}
              disabled={updateUser.isPending}
              className="bg-[#004289] hover:bg-[#003070]"
            >
              {updateUser.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={confirmDeleteId !== null} onOpenChange={open => { if (!open) setConfirmDeleteId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Benutzer löschen?</DialogTitle>
            <DialogDescription>
              Dieser Vorgang kann nicht rückgängig gemacht werden. Der Benutzer verliert sofort den Zugang.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>Abbrechen</Button>
            <Button
              variant="destructive"
              onClick={() => confirmDeleteId !== null && handleDelete(confirmDeleteId)}
              disabled={deleteUser.isPending}
            >
              {deleteUser.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Main settings page ─────────────────────────────────────────────────────────

export default function AdminSettings() {
  const { data, isLoading } = useListNotificationEmails();
  const addEmail = useAddNotificationEmail();
  const deleteEmail = useDeleteNotificationEmail();
  const { data: smtpData, isLoading: smtpLoading } = useGetSmtpConfig();
  const updateSmtp = useUpdateSmtpConfig();
  const testSmtp = useTestSmtpConfig();
  const { data: me } = useGetAdminMe();
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
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Fehler beim Hinzufügen";
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

  const isAdmin = me?.role === "admin";
  const isReadOnly = me?.role === "schulbuero" || me?.role === "fahrer";

  return (
    <AdminLayout>
      <div className="space-y-8 max-w-2xl">
        <h1 className="text-2xl font-serif font-semibold text-primary">Einstellungen</h1>

        {/* User Management — admin only */}
        {isAdmin && <UserManagement currentUserId={undefined} />}

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

                {!isReadOnly && (
                  <Button onClick={handleSmtpSave} disabled={updateSmtp.isPending} className="w-full sm:w-auto">
                    {updateSmtp.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Konfiguration speichern
                  </Button>
                )}

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
                      {!isReadOnly && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:bg-destructive/10 shrink-0"
                          onClick={() => handleDelete(e.id, e.email)}
                          disabled={deleteEmail.isPending}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {!isReadOnly && (
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
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
