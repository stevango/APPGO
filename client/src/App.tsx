import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Tracking from "./pages/Tracking";
import SOS from "./pages/SOS";
import Notifications from "./pages/Notifications";
import Profile from "./pages/Profile";
import Geofences from "./pages/Geofences";
import BlockVehicle from "./pages/BlockVehicle";
import ReportTheft from "./pages/ReportTheft";
import Onboarding from "./pages/Onboarding";
import TripHistory from "./pages/TripHistory";
import ShareLocation from "./pages/ShareLocation";
import SharedView from "./pages/SharedView";
import VehicleSelector from "./pages/VehicleSelector";
import VehicleCare from "./pages/VehicleCare";
import PaymentManagement from "./pages/PaymentManagement";
import PaymentHistory from "./pages/PaymentHistory";
import EmergencyContacts from "./pages/EmergencyContacts";
import MobileLayout from "./components/MobileLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { LoadingSplash, SplashScreen } from "./components/SplashScreen";
import { useState, useEffect, useRef } from "react";

function AuthenticatedApp() {
  return (
    <MobileLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/tracking" component={Tracking} />
        <Route path="/sos" component={SOS} />
        <Route path="/notifications" component={Notifications} />
        <Route path="/profile" component={Profile} />
        <Route path="/geofences" component={Geofences} />
        <Route path="/block" component={BlockVehicle} />
        <Route path="/report-theft" component={ReportTheft} />
        <Route path="/trip-history" component={TripHistory} />
        <Route path="/share" component={ShareLocation} />
        <Route path="/vehicles" component={VehicleSelector} />
        <Route path="/vehicle-care" component={VehicleCare} />
        <Route path="/payment" component={PaymentManagement} />
        <Route path="/payment/history" component={PaymentHistory} />
        <Route path="/emergency-contacts" component={EmergencyContacts} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </MobileLayout>
  );
}

function Router() {
  const { user, loading, isAuthenticated } = useAuth();
  const [showSplash, setShowSplash] = useState(false);
  const wasLoadingRef = useRef(true);

  // Mostrar splash screen quando transiciona de loading para autenticado
  useEffect(() => {
    if (wasLoadingRef.current && !loading && isAuthenticated) {
      setShowSplash(true);
    }
    wasLoadingRef.current = loading;
  }, [loading, isAuthenticated]);

  // Enquanto carrega auth, mostrar splash com mensagens de marca
  if (loading) {
    return <LoadingSplash />;
  }

  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/shared/:token" component={SharedView} />
        <Route><Onboarding /></Route>
      </Switch>
    );
  }

  return (
    <>
      {showSplash && (
        <SplashScreen
          duration={2200}
          onFinish={() => setShowSplash(false)}
        />
      )}
      <Switch>
        <Route path="/shared/:token" component={SharedView} />
        <Route><AuthenticatedApp /></Route>
      </Switch>
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster position="top-center" />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
