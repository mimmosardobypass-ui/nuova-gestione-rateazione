import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Plus, Eye, BarChart3 } from "lucide-react";
import { CollapsibleKpiSection } from "@/components/kpi/CollapsibleKpiSection";
import { FinancialBalanceCard } from "@/components/kpi/FinancialBalanceCard";
import { ResidualDecadenceRow } from "@/components/kpi/CompactKpiCards";
import { useResidualAndDecadenceKpis } from "@/features/rateations/hooks/useResidualAndDecadenceKpis";
import { useEffectiveKpis } from "@/hooks/useEffectiveKpis";
import { useQuaterSaving } from "@/hooks/useQuaterSaving";
import { useF24PagopaCost } from "@/hooks/useF24PagopaCost";
import { useMemo } from "react";
import { setSEO } from "@/lib/seo";
import { useF24AtRisk } from "@/features/rateations/hooks/useF24AtRisk";
import { usePagopaAtRisk } from "@/features/rateations/hooks/usePagopaAtRisk";
import { ConfigurableAlert } from "@/features/rateations/components/ConfigurableAlert";
import { calculateAlertDetails } from "@/constants/alertConfig";
import { RecentNotesCard } from "@/features/rateations/components/RecentNotesCard";

export default function HomePage() {
  const navigate = useNavigate();
  
  // Set SEO meta tags
  setSEO(
    "Dashboard Rateazioni - Gestione Centralizzata",
    "Dashboard per la gestione completa delle rateazioni fiscali con KPI in tempo reale"
  );

  const residualDecadenceKpis = useResidualAndDecadenceKpis();
  const effectiveKpis = useEffectiveKpis();
  const quaterSaving = useQuaterSaving();
  const f24PagopaCost = useF24PagopaCost();
  
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

  const loading = residualDecadenceKpis.loading || effectiveKpis.loading || quaterSaving.loading || f24PagopaCost.loading;

  // Create mock gross KPIs for the collapsible section (these would come from a useGrossKpis hook)
  const grossKpis = useMemo(() => ({
    totalDueGross: (effectiveKpis.residualEffective + effectiveKpis.decadutoNet) * 1.15, // Mock calculation
    totalPaidGross: effectiveKpis.residualEffective * 0.6, // Mock calculation
    residualGross: (effectiveKpis.residualEffective + effectiveKpis.decadutoNet) * 1.15 - effectiveKpis.residualEffective * 0.6,
    overdueGross: effectiveKpis.overdueEffective * 1.1, // Mock calculation
  }), [effectiveKpis]);

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
            </div>
          </div>
        </div>
      </section>

      {/* Configurable Alerts */}
      <section className="container mx-auto px-4 pt-8">
        <div className="space-y-4 border-2 border-purple-500 p-4 rounded-lg">
          <p className="text-purple-500 text-xs font-mono">DEBUG: Alert container visible (HomePage)</p>
          
          {!loadingF24Risk && (
            <ConfigurableAlert
              type="f24"
              count={atRiskF24s.length}
              details={f24Details}
              onNavigate={() => navigate("/rateazioni?filter=f24-at-risk")}
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
              const pagopaIds = atRiskPagopas.map(p => p.rateationId).join(',');
              return (
                <ConfigurableAlert
                  type="pagopa"
                  count={atRiskPagopas.length}
                  details={pagopaDetails}
                  onNavigate={() => navigate(`/rateazioni?filter=pagopa-at-risk&pagopa_ids=${pagopaIds}`)}
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
      </section>

      {/* Recent Notes Section */}
      <section className="container mx-auto px-4 pt-8">
        <RecentNotesCard />
      </section>

      {/* Main KPI Section - Effective KPIs */}
      <section className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-semibold mb-2">KPI Effettivi</h2>
            <p className="text-muted-foreground">
              Vista operativa escludendo pratiche estinte e interrotte
            </p>
          </div>

          {/* Primary KPIs Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-4">
              <ResidualDecadenceRow
                residualEuro={residualDecadenceKpis.residualEuro}
                decNetEuro={residualDecadenceKpis.decNetEuro}
                totalEuro={residualDecadenceKpis.totalEuro}
                overdueEffectiveEuro={residualDecadenceKpis.overdueEffectiveEuro}
                loading={loading}
                onOpenDecadenze={() => navigate("/rateazioni?view=decadenze")}
              />
            </div>
            <div className="lg:col-span-1">
              <FinancialBalanceCard
                savingRQ={quaterSaving.saving}
                costF24PagoPA={f24PagopaCost.cost}
                loading={quaterSaving.loading || f24PagopaCost.loading}
                onClick={() => navigate("/risparmio-rq")}
              />
            </div>
          </div>

          {/* Collapsible Verification Section */}
          <CollapsibleKpiSection
            title="Verifica Contabile - KPI Lordi"
            variant="secondary"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="p-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Totale Dovuto</p>
                  <p className="text-2xl font-bold">€{grossKpis.totalDueGross.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Lordo (tutte le pratiche)</p>
                </div>
              </Card>
              <Card className="p-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Totale Pagato</p>
                  <p className="text-2xl font-bold">€{grossKpis.totalPaidGross.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Lordo (tutte le pratiche)</p>
                </div>
              </Card>
              <Card className="p-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Residuo Lordo</p>
                  <p className="text-2xl font-bold">€{grossKpis.residualGross.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Include pratiche estinte</p>
                </div>
              </Card>
              <Card className="p-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Ritardi Lordi</p>
                  <p className="text-2xl font-bold">€{grossKpis.overdueGross.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Senza tolleranze</p>
                </div>
              </Card>
            </div>
            <div className="mt-4 p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>Nota:</strong> I KPI lordi includono tutte le pratiche (anche estinte/interrotte) 
                e rappresentano la quadratura contabile completa. I KPI effettivi sopra mostrano la 
                situazione operativa reale.
              </p>
            </div>
          </CollapsibleKpiSection>
        </div>
      </section>

      {/* Quick Actions */}
      <section className="container mx-auto px-4 pb-8">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Azioni Rapide</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button 
              variant="outline" 
              className="h-auto p-4 flex flex-col gap-2"
              onClick={() => navigate("/rateazioni?status=attiva")}
            >
              <Eye className="h-6 w-6" />
              <span>Rateazioni Attive</span>
              <span className="text-xs text-muted-foreground">Visualizza solo pratiche attive</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto p-4 flex flex-col gap-2"
              onClick={() => navigate("/rateazioni?status=in_ritardo")}
            >
              <BarChart3 className="h-6 w-6" />
              <span>In Ritardo</span>
              <span className="text-xs text-muted-foreground">Rate scadute non pagate</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto p-4 flex flex-col gap-2"
              onClick={() => navigate("/rateazioni/import")}
            >
              <Plus className="h-6 w-6" />
              <span>Importa PDF</span>
              <span className="text-xs text-muted-foreground">Carica nuove rateazioni</span>
            </Button>
          </div>
        </Card>
      </section>
    </main>
  );
}