import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Calculator, TrendingUp, DollarSign, Euro } from "lucide-react";
import { CompactKpiCard } from "@/components/kpi/CompactKpiCards";
import { RateationsTable } from "@/features/rateations/components/RateationsTable";
import { useRateations } from "@/features/rateations/hooks/useRateations";
import { calcGrossKpis } from "@/utils/stats-utils";
import { useMemo } from "react";
import { setSEO } from "@/lib/seo";

export default function RateationsGross() {
  const navigate = useNavigate();
  
  // Set SEO meta tags
  setSEO(
    "Rateazioni - Vista Completa (KPI Lordi)",
    "Vista completa di tutte le rateazioni con KPI lordi per verifica contabile"
  );

  const { rows: rateations, loading, error, online, handleDelete, refresh, deleting } = useRateations();

  // Calculate gross KPIs
  const grossKpis = useMemo(() => {
    if (!rateations?.length) {
      return {
        totalDueGross: 0,
        totalPaidGross: 0, 
        residualGross: 0,
        overdueGross: 0,
      };
    }
    return calcGrossKpis(rateations);
  }, [rateations]);

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <section className="bg-gradient-to-r from-slate-100 to-slate-50 py-8 border-b">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-4 mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/")}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Torna alla Home
            </Button>
          </div>
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold">Rateazioni - Vista Completa</h1>
            <p className="text-muted-foreground">
              Tutte le rateazioni con KPI lordi per verifica contabile
            </p>
          </div>
        </div>
      </section>

      {/* Gross KPIs Section */}
      <section className="container mx-auto px-4 py-6">
        <div className="space-y-4">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">KPI Lordi</h2>
            <p className="text-sm text-muted-foreground">
              Include tutte le pratiche (anche estinte/interrotte) per quadratura contabile
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <CompactKpiCard
              title="Totale Dovuto"
              value={grossKpis.totalDueGross}
              subtitle="Lordo"
              icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
              loading={loading}
              tooltip="Importo totale dovuto di tutte le rateazioni"
            />
            <CompactKpiCard
              title="Totale Pagato"
              value={grossKpis.totalPaidGross}
              subtitle="Lordo"
              icon={<Euro className="h-4 w-4 text-muted-foreground" />}
              loading={loading}
              tooltip="Importo totale pagato di tutte le rateazioni"
            />
            <CompactKpiCard
              title="Residuo Lordo"
              value={grossKpis.residualGross}
              subtitle="Dovuto - Pagato"
              icon={<Calculator className="h-4 w-4 text-muted-foreground" />}
              loading={loading}
              highlight="primary"
              tooltip="Dovuto meno pagato, include anche pratiche decadute"
            />
            <CompactKpiCard
              title="Ritardi Lordi"
              value={grossKpis.overdueGross}
              subtitle="Senza tolleranze"
              icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
              loading={loading}
              highlight="destructive"
              tooltip="Rate scadute non pagate senza tolleranze"
            />
          </div>

          {/* Info Card */}
          <Card className="p-4 bg-blue-50/50 border-blue-200">
            <div className="flex items-start gap-3">
              <Calculator className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-blue-900 mb-1">Vista Contabile Completa</h3>
                <p className="text-sm text-blue-700">
                  I KPI lordi mostrano la situazione contabile completa includendo tutte le pratiche. 
                  Per la vista operativa (escludendo pratiche estinte/interrotte), 
                  <Button 
                    variant="link" 
                    className="p-0 h-auto text-blue-700 underline ml-1"
                    onClick={() => navigate("/")}
                  >
                    torna alla Home con i KPI effettivi
                  </Button>.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Rateations Table */}
      <section className="container mx-auto px-4 pb-8">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Tutte le Rateazioni</h2>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/rateazioni/new")}
              >
                Nuova Rateazione
              </Button>
            </div>
          </div>
          
          <RateationsTable 
            rows={rateations || []}
            loading={loading}
            error={error}
            online={online}
            onDelete={handleDelete}
            onRefresh={refresh}
            deleting={deleting}
          />
        </Card>
      </section>
    </main>
  );
}