import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Plus, Eye, BarChart3, Calendar, AlertCircle } from "lucide-react";
import { useMemo } from "react";
import { setSEO } from "@/lib/seo";
import { useF24AtRisk } from "@/features/rateations/hooks/useF24AtRisk";
import { usePagopaAtRisk } from "@/features/rateations/hooks/usePagopaAtRisk";
import { useQuaterAtRisk } from "@/features/rateations/hooks/useQuaterAtRisk";
import { ConfigurableAlert } from "@/features/rateations/components/ConfigurableAlert";
import { F24AtRiskAlert } from "@/features/rateations/components/F24AtRiskAlert";
import { AtRiskReportSelector } from "@/features/rateations/components/AtRiskReportSelector";
import { calculateAlertDetails } from "@/constants/alertConfig";
import { RecentNotesCard } from "@/features/rateations/components/RecentNotesCard";
import { FreeNotesCard } from "@/components/FreeNotesCard";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function HomePage() {
  const navigate = useNavigate();
  
  // Set SEO meta tags
  setSEO(
    "Dashboard Rateazioni - Gestione Centralizzata",
    "Dashboard per la gestione completa delle rateazioni fiscali con KPI in tempo reale"
  );

  // Alert hooks with error handling
  const { atRiskF24s, loading: loadingF24Risk, error: errorF24 } = useF24AtRisk();
  const { atRiskPagopas, loading: loadingPagopaRisk, error: errorPagopa } = usePagopaAtRisk();
  const { atRiskQuaters, loading: loadingQuater, error: errorQuater } = useQuaterAtRisk();

  // Safe arrays to prevent crashes
  const safeF24s = Array.isArray(atRiskF24s) ? atRiskF24s : [];
  const safePagopas = Array.isArray(atRiskPagopas) ? atRiskPagopas : [];
  const safeQuaters = Array.isArray(atRiskQuaters) ? atRiskQuaters : [];

  // Log errors for debugging
  if (errorF24) console.error('[HomePage] F24 error:', errorF24);
  if (errorPagopa) console.error('[HomePage] PagoPA error:', errorPagopa);
  if (errorQuater) console.error('[HomePage] Quater error:', errorQuater);

  // Calculate alert details for dynamic messages (using safe arrays)
  const f24Details = useMemo(() => 
    calculateAlertDetails(safeF24s, 'f24'), 
    [safeF24s]
  );
  const pagopaDetails = useMemo(() => 
    calculateAlertDetails(safePagopas, 'pagopa'), 
    [safePagopas]
  );

  // Debug: Log stato alert
  console.log('🟢 [HomePage] Alert State:', {
    f24: { loading: loadingF24Risk, count: safeF24s.length, error: errorF24 },
    pagopa: { loading: loadingPagopaRisk, count: safePagopas.length, error: errorPagopa },
    quater: { loading: loadingQuater, count: safeQuaters.length, error: errorQuater }
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
        <ErrorBoundary fallback={
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Errore nel caricamento degli alert. Riprova ricaricando la pagina.
            </AlertDescription>
          </Alert>
        }>
          <div className="space-y-4">
            {!loadingF24Risk && (
              <F24AtRiskAlert
                atRiskF24s={safeF24s}
                onNavigate={() => navigate('/print/f24-at-risk')}
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
                
                console.log('🟡 [HomePage] Rendering PagoPA ConfigurableAlert with count:', safePagopas.length);
                return (
                  <ConfigurableAlert
                    type="pagopa"
                    count={safePagopas.length}
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
              f24Count={safeF24s.length} 
              pagopaCount={safePagopas.length}
              quaterCount={safeQuaters.length}
            />
          </div>
        </ErrorBoundary>
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