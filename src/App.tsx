// CRITICAL: 2026-01-25T23:40:00 - Removed React namespace import to fix duplication
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import SupabaseOutageBanner from "@/components/SupabaseOutageBanner";
import { AppLayout } from "@/components/AppLayout";
import Dashboard from "./pages/Dashboard";
import HomePage from "./pages/HomePage";
import RateationsGross from "./pages/RateationsGross";
import Rateations from "./pages/Rateations";
import Login from "./pages/Login";
import Test from "./pages/Test";
import StatsV3 from "./pages/StatsV3";
import EvoluzioneRateazioni from "./pages/EvoluzioneRateazioni";
import ScadenzeMatrix from "./pages/ScadenzeMatrix";
import RateationsDebug from "./pages/RateationsDebug";
import NotFound from "./pages/NotFound";
import RisparmiRQ from "./pages/RisparmiRQ";
import ScadenzePrint from "./pages/print/Scadenze";
import RiepilogoReport from "./pages/print/RiepilogoReport";
import SchedaRateazione from "./pages/print/SchedaRateazione";
import AnnualMatrix from "./pages/print/AnnualMatrix";
import RateazioniAtRisk from "./pages/print/RateazioniAtRisk";
import F24AtRisk from "./pages/print/F24AtRisk";
import PagopaAtRisk from "./pages/print/PagopaAtRisk";
import QuaterAtRisk from "./pages/print/QuaterAtRisk";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

function App() {

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <ErrorBoundary fallback={
            <div className="min-h-screen flex items-center justify-center bg-background">
              <div className="text-center space-y-4 p-8 max-w-md">
                <h1 className="text-2xl font-bold text-destructive">Errore Applicazione</h1>
                <p className="text-muted-foreground">
                  Si è verificato un errore critico nell'applicazione. 
                  Ricarica la pagina per riprovare.
                </p>
                <button 
                  onClick={() => window.location.reload()} 
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                >
                  Ricarica Pagina
                </button>
              </div>
            </div>
          }>
            <SupabaseOutageBanner />
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <AppLayout>
                {/* Visual Cache Indicator - Development Only */}
                {import.meta.env.DEV && (
                  <div className="fixed bottom-2 right-2 text-xs bg-primary text-primary-foreground px-2 py-1 rounded shadow-lg z-[9999] font-mono">
                    v{new Date().toISOString().slice(0,10).replace(/-/g,'')}
                  </div>
                )}
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/" element={
                    <ProtectedRoute>
                      <HomePage />
                    </ProtectedRoute>
                  } />
                  <Route path="/dashboard" element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  } />
                  <Route path="/rateazioni-complete" element={
                    <ProtectedRoute>
                      <RateationsGross />
                    </ProtectedRoute>
                  } />
                  <Route path="/rateazioni" element={
                    <ProtectedRoute>
                      <Rateations />
                    </ProtectedRoute>
                  } />
                  <Route path="/statistiche-v3" element={
                    <ProtectedRoute>
                      <StatsV3 />
                    </ProtectedRoute>
                  } />
                  <Route path="/evoluzione-mensile" element={
                    <ProtectedRoute>
                      <EvoluzioneRateazioni />
                    </ProtectedRoute>
                  } />
                  <Route path="/scadenze-matrix" element={
                    <ProtectedRoute>
                      <ScadenzeMatrix />
                    </ProtectedRoute>
                  } />
                  <Route path="/risparmio-rq" element={
                    <ProtectedRoute>
                      <RisparmiRQ />
                    </ProtectedRoute>
                  } />
                  <Route path="/test" element={
                    <ProtectedRoute>
                      <Test />
                    </ProtectedRoute>
                  } />
                  <Route path="/debug" element={
                    <ProtectedRoute>
                      <RateationsDebug />
                    </ProtectedRoute>
                  } />
                  {/* Print routes - senza ProtectedRoute per evitare conflitti React */}
                  <Route path="/print/scadenze" element={<ScadenzePrint />} />
                  <Route path="/print/riepilogo" element={<RiepilogoReport />} />
                  <Route path="/print/rateazione/:id" element={<SchedaRateazione />} />
                  <Route path="/print/annual-matrix" element={<AnnualMatrix />} />
                  <Route path="/print/rateazioni-a-rischio" element={<RateazioniAtRisk />} />
                  <Route path="/print/f24-a-rischio" element={<F24AtRisk />} />
                  <Route path="/print/pagopa-a-rischio" element={<PagopaAtRisk />} />
                  <Route path="/print/quater-a-rischio" element={<QuaterAtRisk />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </AppLayout>
            </BrowserRouter>
          </ErrorBoundary>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
