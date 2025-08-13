import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { setSEO } from "@/lib/seo";
import { useLocation } from "react-router-dom";
import { useRateations } from "@/features/rateations/hooks/useRateations";
import { useRateationStats } from "@/features/rateations/hooks/useRateationStats";
import { RateationsTable } from "@/features/rateations/components/RateationsTable";
import { NewRateationDialog } from "@/features/rateations/components/NewRateationDialog";
import { RateationFilters } from "@/features/rateations/components/RateationFilters";
import { UserMenu } from "@/components/UserMenu";
import { useAuth } from "@/contexts/AuthContext";
import { KpiCards } from "@/features/rateations/components/KpiCards";


export default function Rateations() {
  const { session, loading: authLoading } = useAuth();
  const { rows, loading, error, online, loadData, handleDelete } = useRateations();
  const { stats, loading: statsLoading, error: statsError, reload: reloadStats } = useRateationStats();
  
  // Key per far re-render la tabella dopo creazione
  const [refreshKey, setRefreshKey] = React.useState(0);

  React.useEffect(() => {
    setSEO(
      "Rateazioni - Gestione Rate",
      "Gestisci le tue rateazioni e rate di pagamento"
    );
  }, []);

  React.useEffect(() => {
    if (authLoading) return; // Wait for auth to finish loading
    if (!session) return;    // Don't load data if not authenticated
    loadData();              // Load data only when authenticated
  }, [authLoading, session, loadData]);

  // Leggi il query param per aprire il modale
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const openOnMount = params.get("new") === "1";

  const openComparazione = () => {
    // TODO: Implement comparazione annuale
  };

  const openStats = () => {
    // TODO: Implement statistiche avanzate
  };

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
          <UserMenu />
          <NewRateationDialog 
            initialOpen={openOnMount} 
            onCreated={() => {
              window.location.replace("/rateazioni");
              loadData();
              reloadStats();
              setRefreshKey(prev => prev + 1);
            }}
          />
        </div>
      </div>

      {/* KPI Cards - Always visible */}
      <KpiCards loading={statsLoading} stats={stats} />

      {statsError && (
        <div className="mb-4 text-sm text-destructive">
          Errore nel caricamento statistiche: {statsError}
        </div>
      )}

      <Card className="card-elevated">
        <CardContent className="pt-6">
          <Tabs defaultValue="all">
            <TabsList>
              <TabsTrigger value="all">Tutte</TabsTrigger>
              <TabsTrigger value="attive">Attive</TabsTrigger>
              <TabsTrigger value="completate">Completate</TabsTrigger>
            </TabsList>
            <TabsContent value="all" className="space-y-4">
              <RateationFilters 
                onComparazione={openComparazione}
                onStats={openStats}
              />

              <RateationsTable 
                key={refreshKey}
                rows={rows}
                loading={loading}
                error={error}
                online={online}
                onDelete={(id) => handleDelete(id, reloadStats)}
                onRefresh={() => {
                  loadData();
                  reloadStats();
                  setRefreshKey(prev => prev + 1);
                }}
                onDataChanged={reloadStats}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </main>
  );
}