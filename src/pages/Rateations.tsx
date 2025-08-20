import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { setSEO } from "@/lib/seo";
import { useLocation, useNavigate } from "react-router-dom";
import { useRateations } from "@/features/rateations/hooks/useRateationsWorking";
import { useRateationStats } from "@/features/rateations/hooks/useRateationStats";
import { useDebouncedReload } from "@/hooks/useDebouncedReload";
import { RateationsTablePro } from "@/features/rateations/components/RateationsTablePro";
import type { RateationRowPro } from "@/features/rateations/components/RateationsTablePro";
import { NewRateationDialog } from "@/features/rateations/components/NewRateationDialog";
import { RateationFilters } from "@/features/rateations/components/RateationFilters";
import { UserMenu } from "@/components/UserMenu";
import { useAuth } from "@/contexts/AuthContext";
import { KpiCards } from "@/features/rateations/components/KpiCards";
import { SaldoDecadutoCard } from "@/features/rateations/components/SaldoDecadutoCard";
import { DecadenceDetailView } from "@/features/rateations/components/DecadenceDetailView";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PrintButtons } from "@/components/print/PrintButtons";
import { fetchDecadenceDashboard, fetchDecadenceDetails, linkTransfer } from "@/features/rateations/api/decadence";
import { useToast } from "@/hooks/use-toast";
import type { DecadenceDashboard, DecadenceDetail } from "@/features/rateations/types";

// View components
import { RateList } from "@/features/rateations/components/views/RateList";
import AnnualMatrixCard from "@/features/rateations/components/AnnualMatrixCard";
import { Deadlines } from "@/features/rateations/components/views/Deadlines";
import { AdvancedStats } from "@/features/rateations/components/views/AdvancedStats";


export default function Rateations() {
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const { rows, loading, error, online, loadData, handleDelete, deleting } = useRateations();
  const { toast } = useToast();
  
  const { stats, previousStats, loading: statsLoading, error: statsError, reload: reloadStats } = useRateationStats();
  
  // Decadence state
  const [decadenceDashboard, setDecadenceDashboard] = React.useState<DecadenceDashboard | null>(null);
  const [decadenceDetails, setDecadenceDetails] = React.useState<DecadenceDetail[]>([]);
  const [decadenceLoading, setDecadenceLoading] = React.useState(false);
  
  const { debouncedReload, debouncedReloadStats, cleanup } = useDebouncedReload({
    loadData,
    reloadStats
  });

  // Load decadence data
  const loadDecadenceData = React.useCallback(async () => {
    setDecadenceLoading(true);
    try {
      const [dashboard, details] = await Promise.all([
        fetchDecadenceDashboard(),
        fetchDecadenceDetails()
      ]);
      setDecadenceDashboard(dashboard);
      setDecadenceDetails(details);
    } catch (e: any) {
      console.warn('Failed to load decadence data:', e?.message);
    } finally {
      setDecadenceLoading(false);
    }
  }, []);

  // Global reloader for decadence data
  React.useEffect(() => {
    (window as any).__reloadDecadence = loadDecadenceData;
    return () => { delete (window as any).__reloadDecadence; };
  }, [loadDecadenceData]);

  // Cleanup timeouts on unmount
  React.useEffect(() => cleanup, [cleanup]);
  
  React.useEffect(() => {
    if (authLoading) return; // Wait for auth to finish loading
    if (!session) return;    // Don't load data if not authenticated
    loadData();              // Load data only when authenticated
    loadDecadenceData();     // Load decadence data too
  }, [authLoading, session, loadData, loadDecadenceData]);
  // Key per far re-render la tabella dopo creazione
  const [refreshKey, setRefreshKey] = React.useState(0);

  React.useEffect(() => {
    setSEO(
      "Rateazioni - Gestione Rate",
      "Gestisci le tue rateazioni e rate di pagamento"
    );
  }, []);


  // Leggi il query param per aprire il modale
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const openOnMount = params.get("new") === "1";
  const [showHomeBack, setShowHomeBack] = React.useState(false);

  const cleanupNewParam = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("new");
    window.history.replaceState({}, "", url.toString());
  };

  const handleCancelled = () => {
    cleanupNewParam();
    // Redirect diretto alla home (Dashboard)
    navigate("/", { replace: true });
    // Fallback opzionale: mostrare il bottone invece del redirect
    // setShowHomeBack(true);
  };

  type View = 'list' | 'annual' | 'deadlines' | 'advanced' | 'decadenze';
  const [currentView, setCurrentView] = React.useState<View>('list');

  const handleViewChange = (view: View) => {
    setCurrentView(view);
  };

  const openComparazione = () => {
    setCurrentView('annual');
  };

  const openDeadlines = () => {
    setCurrentView('deadlines');
  };

  const openStats = () => {
    setCurrentView('advanced');
  };

  const openDecadenze = () => {
    setCurrentView('decadenze');
  };

  // Decadence handlers
  const handleCreatePagoPA = React.useCallback((f24Id: number, amount: number) => {
    // Navigate to creation with query params
    navigate(`/rateazioni?new=1&tipo=pagopa&fromDecaduta=${f24Id}&importo=${amount.toFixed(2)}`);
  }, [navigate]);

  const handleOpenRateation = React.useCallback((id: number) => {
    // Navigate to rateation detail view or open in modal
    navigate(`/rateazioni/${id}`);
  }, [navigate]);

  // Show loading screen while auth is initializing
  if (authLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-sm text-muted-foreground">
        Verifica accesso…
      </div>
    );
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
        <h1 className="text-2xl font-bold tracking-tight">Rateazioni</h1>
        <div className="flex items-center gap-2">
          <PrintButtons showSummaryOptions />
          <UserMenu />
          <NewRateationDialog 
            initialOpen={openOnMount} 
            onCreated={() => {
              window.location.replace("/rateazioni");
              debouncedReload();
              setRefreshKey(prev => prev + 1);
            }}
            onCancelled={handleCancelled}
          />
        </div>
      </div>

      {/* Fallback opzionale: bottone visibile dopo annullo */}
      {showHomeBack && (
        <div className="mb-4">
          <Button 
            variant="outline" 
            onClick={() => { 
              cleanupNewParam(); 
              navigate("/", { replace: true }); 
            }}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Torna alla home
          </Button>
        </div>
      )}

      {/* KPI Cards and Saldo Decaduto - Always visible */}
      <div className="grid gap-4 mb-6">
        <KpiCards 
          loading={statsLoading} 
          stats={stats} 
          previousStats={previousStats}
        />
        
        {/* Saldo Decaduto Card */}
        {decadenceDashboard && (
          <div className="grid gap-4">
            <SaldoDecadutoCard 
              data={decadenceDashboard}
              onClick={openDecadenze}
            />
          </div>
        )}
      </div>

      {statsError && (
        <div className="mb-4 text-sm text-destructive">
          Errore nel caricamento statistiche: {statsError}
        </div>
      )}

      {/* View Content */}
      {currentView === 'list' && (
        <RateList 
          rows={rows}
          loading={loading}
          error={error}
          online={online}
          onDelete={(id) => handleDelete(id, debouncedReloadStats)}
          deleting={deleting}
          onRefresh={() => {
            debouncedReload();
            setRefreshKey(prev => prev + 1);
          }}
          onDataChanged={debouncedReloadStats}
          refreshKey={refreshKey}
          onViewChange={handleViewChange}
        />
      )}

      {currentView === 'annual' && (
        <AnnualMatrixCard 
          onBack={() => setCurrentView('list')}
        />
      )}

      {currentView === 'deadlines' && (
        <Deadlines 
          rows={rows}
          loading={loading}
          onBack={() => setCurrentView('list')}
        />
      )}

      {currentView === 'advanced' && (
        <AdvancedStats 
          rows={rows}
          loading={loading}
          onBack={() => setCurrentView('list')}
        />
      )}

      {currentView === 'decadenze' && (
        <DecadenceDetailView
          decadenceDetails={decadenceDetails}
          onCreatePagoPA={handleCreatePagoPA}
          onOpenRateation={handleOpenRateation}
          loading={decadenceLoading}
        />
      )}
    </main>
  );
}