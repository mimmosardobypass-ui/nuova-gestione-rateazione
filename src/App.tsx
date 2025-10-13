import React, { Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import SupabaseOutageBanner from "@/components/SupabaseOutageBanner";
import { AppLayout } from "@/components/AppLayout";
import Dashboard from "./pages/Dashboard";
import HomePage from "./pages/HomePage";
import RateationsGross from "./pages/RateationsGross";
import Rateations from "./pages/Rateations";
import Login from "./pages/Login";
import Test from "./pages/Test";
import Stats from "./pages/Stats";
import AdvancedStats from "./pages/AdvancedStats";
import StatsV3 from "./pages/StatsV3";
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
            <Route path="/statistiche" element={
              <ProtectedRoute>
                <Stats />
              </ProtectedRoute>
            } />
            <Route path="/statistiche-v2" element={
              <ProtectedRoute>
                <AdvancedStats />
              </ProtectedRoute>
            } />
            <Route path="/statistiche-v3" element={
              <ProtectedRoute>
                <StatsV3 />
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
          </AppLayout>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
  );
};

export default App;
