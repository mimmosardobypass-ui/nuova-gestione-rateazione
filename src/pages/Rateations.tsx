import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { setSEO } from "@/lib/seo";
import { useLocation, useNavigate } from "react-router-dom";
import { useAllRateations } from "@/hooks/useAllRateations";
import { useRateationStats } from "@/features/rateations/hooks/useRateationStats";
import { useDebouncedReload } from "@/hooks/useDebouncedReload";
import { useQuaterSaving } from "@/hooks/useQuaterSaving";
import { RateationsTablePro } from "@/features/rateations/components/RateationsTablePro";
import type { RateationRowPro } from "@/features/rateations/components/RateationsTablePro";
import { NewRateationDialog } from "@/features/rateations/components/NewRateationDialog";
import { RateationFilters } from "@/features/rateations/components/RateationFilters";
import { UserMenu } from "@/components/UserMenu";
import { useAuth } from "@/contexts/AuthContext";
import { KpiCards } from "@/features/rateations/components/KpiCards";
import { SaldoDecadutoCard } from "@/features/rateations/components/SaldoDecadutoCard";
import { FinancialBalanceCard } from "@/components/kpi/FinancialBalanceCard";
import { DecadenceDetailView } from "@/features/rateations/components/DecadenceDetailView";
import { useF24PagopaCost } from "@/hooks/useF24PagopaCost";
import { ArrowLeft, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PrintButtons } from "@/components/print/PrintButtons";
import { fetchDecadenceDashboard, fetchDecadenceDetails, fetchDecadencePreview, linkTransfer } from "@/features/rateations/api/decadence";
import { useToast } from "@/hooks/use-toast";
import type { DecadenceDashboard, DecadenceDetail } from "@/features/rateations/types";

// View components
import { RateList } from "@/features/rateations/components/views/RateList";
import AnnualMatrixCard from "@/features/rateations/components/AnnualMatrixCard";
import { AnnualComparisonV2 } from "@/features/rateations/components/views/AnnualComparisonV2";
import { Deadlines } from "@/features/rateations/components/views/Deadlines";
import { RateationsHealthBanner } from "@/components/RateationsHealthBanner";


export default function Rateations() {
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const { rows, loading, error, online } = useAllRateations();
  const { toast } = useToast();
  
  const { stats, previousStats, loading: statsLoading, error: statsError, reload: reloadStats } = useRateationStats();
  const { saving: quaterSaving, loading: savingLoading, reload: reloadSaving } = useQuaterSaving();
  const { cost: f24PagopaCost, loading: costLoading, reload: reloadCost } = useF24PagopaCost();
  
  // Decadence state
  const [decadenceDashboard, setDecadenceDashboard] = React.useState<DecadenceDashboard | null>(null);
  const [decadenceDetails, setDecadenceDetails] = React.useState<DecadenceDetail[]>([]);
  const [decadencePreviewCents, setDecadencePreviewCents] = React.useState<number>(0);
  const [decadenceLoading, setDecadenceLoading] = React.useState(false);
  
  const { debouncedReload, debouncedReloadStats, cleanup } = useDebouncedReload({
    loadData: () => Promise.resolve(), // useAllRateations handles loading automatically
    reloadStats
  });

  // Load decadence data
  const loadDecadenceData = React.useCallback(async () => {
    setDecadenceLoading(true);
    try {
      const [dashboard, details, preview] = await Promise.all([
        fetchDecadenceDashboard(),
        fetchDecadenceDetails(),
        fetchDecadencePreview()
      ]);
      setDecadenceDashboard(dashboard);
      setDecadenceDetails(details);
      setDecadencePreviewCents(preview);
    } catch (e: any) {
      console.warn('Failed to load decadence data:', e?.message);
      // Set fallback values on error
      setDecadenceDashboard({ gross_decayed: 0, transferred: 0, net_to_transfer: 0 });
      setDecadencePreviewCents(0);
    } finally {
      setDecadenceLoading(false);
    }
  }, []);

  // Global event listener for KPI reloads
  React.useEffect(() => {
    const handleKpiReload = () => {
      reloadStats();          // Reload KPI stats
      reloadSaving();         // Reload Quater saving
      reloadCost();           // Reload F24→PagoPA cost
      loadDecadenceData();    // Reload Saldo Decaduto
    };
    
    window.addEventListener('rateations:reload-kpis', handleKpiReload);
    return () => window.removeEventListener('rateations:reload-kpis', handleKpiReload);
  }, [reloadStats, reloadSaving, reloadCost, loadDecadenceData]);

  // Cleanup timeouts on unmount
  React.useEffect(() => cleanup, [cleanup]);
  
  React.useEffect(() => {
    if (authLoading) return; // Wait for auth to finish loading
    if (!session) return;    // Don't load data if not authenticated
    // useAllRateations handles loading automatically
    loadDecadenceData();     // Load decadence data
  }, [authLoading, session, loadDecadenceData]);
  // Key per far re-render la tabella dopo creazione
  const [refreshKey, setRefreshKey] = React.useState(0);

  React.useEffect(() => {
    setSEO(
      "Rateazioni - Gestione Rate",
      "Gestisci le tue rateazioni e rate di pagamento"
    );
    
    // Clear cache after switching to useAllRateations
    window.dispatchEvent(new Event('rateations:reload-kpis'));
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

  type View = 'list' | 'annual' | 'annual-v2' | 'deadlines' | 'decadenze';
  const [currentView, setCurrentView] = React.useState<View>('list');

  // Initialize view from URL on mount
  React.useEffect(() => {
    const viewParam = params.get('view');
    if (viewParam === 'annual-comparison') {
      setCurrentView('annual');
    } else if (viewParam === 'annual-comparison-v2') {
      setCurrentView('annual-v2');
    } else if (viewParam === 'deadlines') {
      setCurrentView('deadlines');
    }
  }, []);

  const handleViewChange = (view: 'annual' | 'annual-v2' | 'deadlines') => {
    setCurrentView(view);
  };

  const openComparazione = () => {
    setCurrentView('annual');
  };

  const openDeadlines = () => {
    setCurrentView('deadlines');
  };

  const openStats = () => {
    navigate('/statistiche');
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
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Rateazioni</h1>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate("/")}
            className="gap-2"
            title="Torna alla Home"
          >
            <Home className="h-4 w-4" />
            Home
          </Button>
        </div>
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

      {/* Health Check Banner */}
      <RateationsHealthBanner />

      {/* KPI Cards and Saldo Decaduto - Always visible */}
      <div className="grid gap-4 mb-6">
        <KpiCards 
          loading={statsLoading} 
          stats={stats} 
          previousStats={previousStats}
        />
        
        {/* Financial Balance Card */}
        <FinancialBalanceCard 
          savingRQ={quaterSaving}
          costF24PagoPA={f24PagopaCost}
          loading={savingLoading || costLoading}
          onClick={() => navigate("/risparmio-rq")}
        />
        
        {/* Saldo Decaduto Card */}
        {decadenceDashboard && (
          <div className="grid gap-4">
            <SaldoDecadutoCard 
              data={decadenceDashboard}
              previewCents={decadencePreviewCents}
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
          onRefresh={() => {
            debouncedReload();
            setRefreshKey(prev => prev + 1);
          }}
          onDataChanged={debouncedReloadStats}
          refreshKey={refreshKey}
          onViewChange={handleViewChange}
          onStats={openStats}
        />
      )}

      {currentView === 'annual' && (
        <AnnualMatrixCard 
          onBack={() => setCurrentView('list')}
        />
      )}

      {currentView === 'annual-v2' && (
        <AnnualComparisonV2 
          rows={rows}
          loading={loading}
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