import React, { Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import SupabaseOutageBanner from "@/components/SupabaseOutageBanner";
import Dashboard from "./pages/Dashboard";
import Rateations from "./pages/Rateations";
import Login from "./pages/Login";
import Test from "./pages/Test";
import RateationsDebug from "./pages/RateationsDebug";
import NotFound from "./pages/NotFound";
import RisparmiRQ from "./pages/RisparmiRQ";

// Lazy load print components
const RiepilogoReport = React.lazy(() => import("./pages/print/RiepilogoReport"));
const SchedaRateazione = React.lazy(() => import("./pages/print/SchedaRateazione"));
const AnnualMatrix = React.lazy(() => import("./pages/print/AnnualMatrix"));

const queryClient = new QueryClient();

const App = () => {
  // Pre-warm PDF.js per eliminare ritardo al primo uso
  useEffect(() => {
    import('@/lib/pdfjs').then(m => m.ensurePdfjsReady()).catch(() => {});
  }, []);

  return (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <SupabaseOutageBanner />
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/rateazioni" element={
              <ProtectedRoute>
                <Rateations />
              </ProtectedRoute>
            } />
            <Route path="/print/riepilogo" element={
              <ProtectedRoute>
                <Suspense fallback={<div>Caricamento...</div>}>
                  <RiepilogoReport />
                </Suspense>
              </ProtectedRoute>
            } />
            <Route path="/print/rateazione/:id" element={
              <ProtectedRoute>
                <Suspense fallback={<div>Caricamento...</div>}>
                  <SchedaRateazione />
                </Suspense>
              </ProtectedRoute>
            } />
            <Route path="/print/annual-matrix" element={
              <ProtectedRoute>
                <Suspense fallback={<div>Caricamento...</div>}>
                  <AnnualMatrix />
                </Suspense>
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
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
  );
};

export default App;
