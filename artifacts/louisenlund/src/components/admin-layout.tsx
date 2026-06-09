import { useGetAdminMe, useAdminLogout } from "@workspace/api-client-react";
import { Redirect } from "wouter";
import { Loader2, MapPin, Euro, Bus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import logo from "@assets/Logo_-_Stiftung_Louisenlund_Print_1780387424925.png";

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: me, isLoading } = useGetAdminMe();
  const logout = useAdminLogout();

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

  const isFahrer = me?.role === "fahrer";
  const isLimitedRole = me?.role === "fahrer" || me?.role === "schulbuero";
  const hiddenSettings = isLimitedRole || me?.role === "buchhaltung";

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        window.location.href = "/admin/login";
      }
    });
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[#f0f0f0]">
      {/* Blue admin header */}
      <header className="ll-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-0 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-white rounded px-2 py-0.5">
              <img src={logo} alt="Stiftung Louisenlund" className="h-8 w-auto" />
            </div>
            <nav className="flex items-center gap-1">
              <Link href="/admin">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-blue-100 hover:text-white hover:bg-white/10"
                >
                  Dashboard
                </Button>
              </Link>
              <Link href="/admin/bookings">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-blue-100 hover:text-white hover:bg-white/10"
                >
                  Buchungen
                </Button>
              </Link>
              <Link href="/admin/map">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-blue-100 hover:text-white hover:bg-white/10"
                >
                  <MapPin className="w-3.5 h-3.5 mr-1" />
                  Karte
                </Button>
              </Link>
              {!isFahrer && (
                <Link href="/admin/pricing">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-blue-100 hover:text-white hover:bg-white/10"
                  >
                    <Euro className="w-3.5 h-3.5 mr-1" />
                    Tarife
                  </Button>
                </Link>
              )}
              <Link href="/admin/buses">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-blue-100 hover:text-white hover:bg-white/10"
                >
                  <Bus className="w-3.5 h-3.5 mr-1" />
                  Busse
                </Button>
              </Link>
              {!hiddenSettings && (
                <Link href="/admin/settings">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-blue-100 hover:text-white hover:bg-white/10"
                  >
                    Einstellungen
                  </Button>
                </Link>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end leading-tight">
              <span className="text-white text-xs font-medium">{me.username}</span>
              <span className="text-blue-300 text-[10px]">
                {{ admin: "Admin", buchhaltung: "Buchhaltung", schulbuero: "Schulbüro", fahrer: "Fahrer" }[me.role ?? ""] ?? me.role}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="border-white/30 text-white hover:bg-white hover:text-[#004289] text-xs"
            >
              Abmelden
            </Button>
          </div>
        </div>
        <div className="ll-accent-bar" />
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      <footer className="border-t border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <p className="text-xs text-[#666666]">
            © {new Date().getFullYear()} Stiftung Louisenlund · Buchungssystem Regionalshuttle 2026/27
          </p>
        </div>
      </footer>
    </div>
  );
}
