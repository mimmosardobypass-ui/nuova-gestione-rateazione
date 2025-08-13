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
import { Skeleton } from "@/components/ui/skeleton";

const StatCard = ({ label, value, loading }: { label: string; value: string; loading: boolean }) => (
  <Card className="card-elevated">
    <CardHeader className="pb-2">
      <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
    </CardHeader>
    <CardContent>
      {loading ? (
        <Skeleton className="h-8 w-24" />
      ) : (
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
      )}
    </CardContent>
  </Card>
);

export default function Rateations() {
  const { session, loading: authLoading } = useAuth();
  const { rows, loading, error, online, loadData, handleDelete } = useRateations();
  const { stats, loading: statsLoading, reload: reloadStats } = useRateationStats();
  
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

  const euro = (n: number) =>
    n.toLocaleString("it-IT", { style: "currency", currency: "EUR" });

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
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard 
          label="Totale dovuto" 
          value={euro(stats.total_due)} 
          loading={statsLoading} 
        />
        <StatCard 
          label="Totale pagato" 
          value={euro(stats.total_paid)} 
          loading={statsLoading} 
        />
        <StatCard 
          label="Totale residuo" 
          value={euro(stats.total_residual)} 
          loading={statsLoading} 
        />
        <StatCard 
          label="In ritardo" 
          value={euro(stats.total_late)} 
          loading={statsLoading} 
        />
      </section>

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
                onDelete={handleDelete}
                onRefresh={() => {
                  loadData();
                  reloadStats();
                  setRefreshKey(prev => prev + 1);
                }}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </main>
  );
}