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

// Após um deploy novo, os chunks antigos somem do servidor. Se a sessão estava
// aberta, o import dinâmico falha ("Failed to fetch dynamically imported
// module"). Recarregamos uma vez para pegar a versão nova (sem loop infinito).
function lazyWithRetry(factory: () => Promise<any>) {
  return lazy(() =>
    factory().catch((err: unknown) => {
      const key = "go-chunk-reload-at";
      const last = Number(sessionStorage.getItem(key) || 0);
      if (Date.now() - last > 10000) {
        sessionStorage.setItem(key, String(Date.now()));
        window.location.reload();
      }
      throw err;
    }),
  );
}

// Lazy-loaded pages: each becomes its own chunk, so the initial load only ships
// what the first screen needs. Heavy pages (maps, charts) load on demand.
const Home = lazyWithRetry(() => import("./pages/Home"));
const Tracking = lazyWithRetry(() => import("./pages/Tracking"));
const SOS = lazyWithRetry(() => import("./pages/SOS"));
const Notifications = lazyWithRetry(() => import("./pages/Notifications"));
const AlertsHistory = lazyWithRetry(() => import("./pages/AlertsHistory"));
const Profile = lazyWithRetry(() => import("./pages/Profile"));
const Geofences = lazyWithRetry(() => import("./pages/Geofences"));
const BlockVehicle = lazyWithRetry(() => import("./pages/BlockVehicle"));
const ReportTheft = lazyWithRetry(() => import("./pages/ReportTheft"));
const TripHistory = lazyWithRetry(() => import("./pages/TripHistory"));
const ShareLocation = lazyWithRetry(() => import("./pages/ShareLocation"));
const SharedView = lazyWithRetry(() => import("./pages/SharedView"));
const VehicleSelector = lazyWithRetry(() => import("./pages/VehicleSelector"));
const VehicleCare = lazyWithRetry(() => import("./pages/VehicleCare"));
const PaymentManagement = lazyWithRetry(() => import("./pages/PaymentManagement"));
const PaymentHistory = lazyWithRetry(() => import("./pages/PaymentHistory"));
const EmergencyContacts = lazyWithRetry(() => import("./pages/EmergencyContacts"));
const Help = lazyWithRetry(() => import("./pages/Help"));
const Legal = lazyWithRetry(() => import("./pages/Legal"));
const Contract = lazyWithRetry(() => import("./pages/Contract"));
const Jornada = lazyWithRetry(() => import("./pages/Jornada"));
const AdminVehicleImages = lazyWithRetry(() => import("./pages/AdminVehicleImages"));
const VehicleDetails = lazyWithRetry(() => import("./pages/VehicleDetails"));
const FichaTecnica = lazyWithRetry(() => import("./pages/FichaTecnica"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));

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
