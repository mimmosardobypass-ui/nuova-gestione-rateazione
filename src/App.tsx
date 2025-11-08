import React from "react";
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

function App() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5,
        retry: 1,
      },
    },
  });

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
                  <Route path="/print/scadenze" element={
                    <ProtectedRoute>
                      <ScadenzePrint />
                    </ProtectedRoute>
                  } />
                  <Route path="/print/riepilogo" element={
                    <ProtectedRoute>
                      <RiepilogoReport />
                    </ProtectedRoute>
                  } />
                  <Route path="/print/rateazione/:id" element={
                    <ProtectedRoute>
                      <SchedaRateazione />
                    </ProtectedRoute>
                  } />
                  <Route path="/print/annual-matrix" element={
                    <ProtectedRoute>
                      <AnnualMatrix />
                    </ProtectedRoute>
                  } />
                  <Route path="/print/rateazioni-a-rischio" element={
                    <ProtectedRoute>
                      <RateazioniAtRisk />
                    </ProtectedRoute>
                  } />
                  <Route path="/print/f24-a-rischio" element={
                    <ProtectedRoute>
                      <F24AtRisk />
                    </ProtectedRoute>
                  } />
                  <Route path="/print/pagopa-a-rischio" element={
                    <ProtectedRoute>
                      <PagopaAtRisk />
                    </ProtectedRoute>
                  } />
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
