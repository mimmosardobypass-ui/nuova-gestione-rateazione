import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Plus, Eye, BarChart3, Calendar } from "lucide-react";
import { useMemo } from "react";
import { setSEO } from "@/lib/seo";
import { useF24AtRisk } from "@/features/rateations/hooks/useF24AtRisk";
import { usePagopaAtRisk } from "@/features/rateations/hooks/usePagopaAtRisk";
import { ConfigurableAlert } from "@/features/rateations/components/ConfigurableAlert";
import { AtRiskReportSelector } from "@/features/rateations/components/AtRiskReportSelector";
import { calculateAlertDetails } from "@/constants/alertConfig";
import { RecentNotesCard } from "@/features/rateations/components/RecentNotesCard";
import { FreeNotesCard } from "@/components/FreeNotesCard";

export default function HomePage() {
  const navigate = useNavigate();
  
  // Set SEO meta tags
  setSEO(
    "Dashboard Rateazioni - Gestione Centralizzata",
    "Dashboard per la gestione completa delle rateazioni fiscali con KPI in tempo reale"
  );

  // Alert hooks
  const { atRiskF24s, loading: loadingF24Risk } = useF24AtRisk();
  const { atRiskPagopas, loading: loadingPagopaRisk } = usePagopaAtRisk();

  // Calculate alert details for dynamic messages
  const f24Details = useMemo(() => 
    calculateAlertDetails(atRiskF24s, 'f24'), 
    [atRiskF24s]
  );
  const pagopaDetails = useMemo(() => 
    calculateAlertDetails(atRiskPagopas, 'pagopa'), 
    [atRiskPagopas]
  );

  // Debug: Log stato alert PagoPA
  console.log('🟢 [HomePage] PagoPA Alert State:', {
    loading: loadingPagopaRisk,
    count: atRiskPagopas.length,
    details: pagopaDetails,
    items: atRiskPagopas
  });


  return (
    <main className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-primary/10 to-primary/5 py-12">
        <div className="container mx-auto px-4">
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold">Dashboard Rateazioni</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Gestione centralizzata delle tue rateazioni fiscali con vista sui KPI effettivi
            </p>
            <div className="flex flex-wrap gap-4 justify-center mt-8">
              <Button 
                onClick={() => navigate("/rateazioni")}
                size="lg"
                className="gap-2"
              >
                <Eye className="h-4 w-4" />
                Vedi Rateazioni
              </Button>
              <Button 
                onClick={() => navigate("/rateazioni/new")}
                variant="outline"
                size="lg"
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Nuova Rateazione
              </Button>
              <Button 
                onClick={() => navigate("/statistiche-v3")}
                variant="default"
                size="lg"
                className="gap-2"
              >
                <BarChart3 className="h-4 w-4" />
                Statistiche
              </Button>
              <Button 
                onClick={() => navigate("/scadenze-matrix")}
                variant="outline"
                size="lg"
                className="gap-2"
              >
                <Calendar className="h-4 w-4" />
                Scadenze Matrix
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Configurable Alerts */}
      <section className="container mx-auto px-4 pt-8">
        <div className="space-y-4">
          {!loadingF24Risk && (
            <ConfigurableAlert
              type="f24"
              count={atRiskF24s.length}
              details={f24Details}
            />
          )}
          
          {(() => {
            try {
              if (loadingPagopaRisk) {
                return (
                  <div className="border border-muted bg-muted/10 p-4 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <p className="text-sm text-muted-foreground">
                        Caricamento alert PagoPA...
                      </p>
                    </div>
                  </div>
                );
              }
              
              console.log('🟡 [HomePage] Rendering PagoPA ConfigurableAlert with count:', atRiskPagopas.length);
              return (
                <ConfigurableAlert
                  type="pagopa"
                  count={atRiskPagopas.length}
                  details={pagopaDetails}
                />
              );
            } catch (error) {
              console.error('🔴 [HomePage] Error rendering PagoPA alert:', error);
              return (
                <div className="border border-destructive bg-destructive/10 p-4 rounded-lg">
                  <p className="text-sm text-destructive font-semibold">
                    Errore visualizzazione alert PagoPA
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {String(error)}
                  </p>
                </div>
              );
            }
          })()}
        </div>

        {/* Global At-Risk Report Selector */}
        <div className="mt-6">
          <AtRiskReportSelector 
            f24Count={atRiskF24s.length} 
            pagopaCount={atRiskPagopas.length} 
          />
        </div>
      </section>

      {/* Recent Notes & Promemoria Section */}
      <section className="container mx-auto px-4 pt-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <RecentNotesCard />
          <FreeNotesCard />
        </div>
      </section>


    </main>
  );
}