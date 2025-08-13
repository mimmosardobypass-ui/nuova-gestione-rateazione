import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { setSEO } from "@/lib/seo";
import { useLocation } from "react-router-dom";
import { useRateations } from "@/features/rateations/hooks/useRateations";
import { RateationsTable } from "@/features/rateations/components/RateationsTable";
import { NewRateationDialog } from "@/features/rateations/components/NewRateationDialog";
import { RateationFilters } from "@/features/rateations/components/RateationFilters";
import { UserMenu } from "@/components/UserMenu";

export default function Rateations() {
  const { rows, loading, error, online, loadData, handleDelete } = useRateations();
  
  // Key per far re-render la tabella dopo creazione
  const [refreshKey, setRefreshKey] = React.useState(0);

  React.useEffect(() => {
    setSEO(
      "Rateazioni - Gestione Rate",
      "Gestisci le tue rateazioni e rate di pagamento"
    );
    loadData();
  }, [loadData]);

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
              setRefreshKey(prev => prev + 1);
            }} 
          />
        </div>
      </div>

      <Card className="card-elevated mt-6">
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