import { Suspense } from "react";
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

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <ErrorBoundary>
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
