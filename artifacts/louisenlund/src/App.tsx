import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import Home from "./pages/home";
import BookingForm from "./pages/booking/index";
import BookingSuccess from "./pages/booking/success";
import AdminLogin from "./pages/admin/login";
import AdminDashboard from "./pages/admin/index";
import AdminBookingsList from "./pages/admin/bookings/index";
import AdminBookingDetail from "./pages/admin/bookings/[id]";
import AdminSettings from "./pages/admin/settings";
import AdminMap from "./pages/admin/map";
import AdminPricing from "./pages/admin/pricing";
import Impressum from "./pages/impressum";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/booking" component={BookingForm} />
      <Route path="/booking/success" component={BookingSuccess} />
      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/bookings" component={AdminBookingsList} />
      <Route path="/admin/bookings/:id" component={AdminBookingDetail} />
      <Route path="/admin/settings" component={AdminSettings} />
      <Route path="/admin/map" component={AdminMap} />
      <Route path="/admin/pricing" component={AdminPricing} />
      <Route path="/impressum" component={Impressum} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;