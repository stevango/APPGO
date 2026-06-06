import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Onboarding from "./pages/Onboarding";
import MobileLayout from "./components/MobileLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { LoadingSplash, SplashScreen } from "./components/SplashScreen";
import PageLoader from "./components/PageLoader";
import { useState, useEffect, useRef, lazy, Suspense } from "react";

// Lazy-loaded pages: each becomes its own chunk, so the initial load only ships
// what the first screen needs. Heavy pages (maps, charts) load on demand.
const Home = lazy(() => import("./pages/Home"));
const Tracking = lazy(() => import("./pages/Tracking"));
const SOS = lazy(() => import("./pages/SOS"));
const Notifications = lazy(() => import("./pages/Notifications"));
const AlertsHistory = lazy(() => import("./pages/AlertsHistory"));
const Profile = lazy(() => import("./pages/Profile"));
const Geofences = lazy(() => import("./pages/Geofences"));
const BlockVehicle = lazy(() => import("./pages/BlockVehicle"));
const ReportTheft = lazy(() => import("./pages/ReportTheft"));
const TripHistory = lazy(() => import("./pages/TripHistory"));
const ShareLocation = lazy(() => import("./pages/ShareLocation"));
const SharedView = lazy(() => import("./pages/SharedView"));
const VehicleSelector = lazy(() => import("./pages/VehicleSelector"));
const VehicleCare = lazy(() => import("./pages/VehicleCare"));
const PaymentManagement = lazy(() => import("./pages/PaymentManagement"));
const PaymentHistory = lazy(() => import("./pages/PaymentHistory"));
const EmergencyContacts = lazy(() => import("./pages/EmergencyContacts"));
const Help = lazy(() => import("./pages/Help"));
const Legal = lazy(() => import("./pages/Legal"));
const Contract = lazy(() => import("./pages/Contract"));
const Jornada = lazy(() => import("./pages/Jornada"));
const AdminVehicleImages = lazy(() => import("./pages/AdminVehicleImages"));
const VehicleDetails = lazy(() => import("./pages/VehicleDetails"));
const FichaTecnica = lazy(() => import("./pages/FichaTecnica"));
const NotFound = lazy(() => import("./pages/NotFound"));

function AuthenticatedApp() {
  return (
    <MobileLayout>
      <Suspense fallback={<PageLoader />}>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/tracking" component={Tracking} />
          <Route path="/sos" component={SOS} />
          <Route path="/notifications" component={Notifications} />
          <Route path="/alerts-history" component={AlertsHistory} />
          <Route path="/profile" component={Profile} />
          <Route path="/geofences" component={Geofences} />
          <Route path="/block" component={BlockVehicle} />
          <Route path="/report-theft" component={ReportTheft} />
          <Route path="/trip-history" component={TripHistory} />
          <Route path="/share" component={ShareLocation} />
          <Route path="/vehicles" component={VehicleSelector} />
          <Route path="/vehicle/:id" component={VehicleDetails} />
          <Route path="/ficha/:id" component={FichaTecnica} />
          <Route path="/vehicle-care" component={VehicleCare} />
          <Route path="/payment" component={PaymentManagement} />
          <Route path="/payment/history" component={PaymentHistory} />
          <Route path="/emergency-contacts" component={EmergencyContacts} />
          <Route path="/help" component={Help} />
          <Route path="/legal" component={Legal} />
          <Route path="/contract" component={Contract} />
          <Route path="/jornada" component={Jornada} />
          <Route path="/admin/vehicle-images" component={AdminVehicleImages} />
          <Route path="/404" component={NotFound} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
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
      <Suspense fallback={<PageLoader />}>
        <Switch>
          <Route path="/shared/:token" component={SharedView} />
          <Route><Onboarding /></Route>
        </Switch>
      </Suspense>
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
      <Suspense fallback={<PageLoader />}>
        <Switch>
          <Route path="/shared/:token" component={SharedView} />
          <Route><AuthenticatedApp /></Route>
        </Switch>
      </Suspense>
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
