import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useGetAdminMe } from "@workspace/api-client-react";
import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useAdminLogout } from "@workspace/api-client-react";

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: me, isLoading } = useGetAdminMe();
  const logout = useAdminLogout();

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!me?.authenticated) {
    return <Redirect to="/admin/login" />;
  }

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        window.location.href = "/admin/login";
      }
    });
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-muted/10">
      <header className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <h1 className="text-lg font-serif font-semibold text-primary">Louisenlund Admin</h1>
            <nav className="hidden sm:flex items-center gap-4">
              <Link href="/admin">
                <Button variant="ghost" size="sm">Dashboard</Button>
              </Link>
              <Link href="/admin/bookings">
                <Button variant="ghost" size="sm">Buchungen</Button>
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:inline-block">Angemeldet</span>
            <Button variant="outline" size="sm" onClick={handleLogout}>Abmelden</Button>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}