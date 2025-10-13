import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ChevronDown, ChevronUp, FileSpreadsheet, FileText, AlertCircle } from "lucide-react";
import { StatsFiltersComponent } from "./StatsFilters";
import { StatsKPI } from "./StatsKPI";
import { StatsByTypeChart } from "./StatsByTypeChart";
import { StatsByStatusPie } from "./StatsByStatusPie";
import { StatsCashflowLine } from "./StatsCashflowLine";
import { StatsTables } from "./StatsTables";
import { ResidualDetailTable } from "./ResidualDetailTable";
import { ExportButtons } from "./ExportButtons";
import { useStats } from "../../hooks/useStats";
import { useResidualDetail } from "../../hooks/useResidualDetail";
import type { StatsFilters, CollapsedSections } from "../../types/stats";
import { loadFilters, saveFilters, getDefaultFilters, loadLayout, saveLayout, loadResidualPrefs } from "../../utils/statsFilters";
import { exportResidualToExcel, exportResidualToPDF } from "../../utils/statsExport";
import { useFitToWidth } from '@/hooks/useFitToWidth';

export function StatsView() {
  const containerRef = useFitToWidth<HTMLDivElement>({ minScale: 0.85 });
  
  const [filters, setFilters] = useState<StatsFilters>(loadFilters);
  const [activeFilters, setActiveFilters] = useState<StatsFilters>(filters);
  const [collapsed, setCollapsed] = useState<CollapsedSections>(loadLayout);

  const { stats, kpis, loading, error } = useStats(activeFilters);
  const { rows: residualRows, loading: residualLoading, error: residualError } = useResidualDetail(activeFilters);

  useEffect(() => {
    saveFilters(filters);
  }, [filters]);

  useEffect(() => {
    saveLayout(collapsed);
  }, [collapsed]);

  const handleApplyFilters = (newFilters: StatsFilters) => {
    setFilters(newFilters);
    setActiveFilters(newFilters);
  };

  const handleResetFilters = () => {
    const defaults = getDefaultFilters();
    setFilters(defaults);
    setActiveFilters(defaults);
  };

  const toggleSection = (section: keyof CollapsedSections) => {
    setCollapsed(prev => ({ ...prev, [section]: !prev[section] }));
  };

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-destructive">Errore: {error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Statistiche</h1>
        <ExportButtons
          stats={stats}
          kpis={kpis}
          filters={activeFilters}
          disabled={loading || !stats}
        />
      </div>

      <StatsFiltersComponent
        filters={filters}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
      />

      {/* KPIs Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between cursor-pointer" onClick={() => toggleSection('kpis')}>
          <CardTitle>KPI</CardTitle>
          <Button variant="ghost" size="sm">
            {collapsed.kpis ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
        </CardHeader>
        {!collapsed.kpis && (
          <CardContent>
            <StatsKPI kpis={kpis} loading={loading} />
          </CardContent>
        )}
      </Card>

      {/* No Results Alert */}
      {!loading && stats && stats.by_type.length === 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Nessun risultato</AlertTitle>
          <AlertDescription>
            {activeFilters.typeLabels?.some(t => t.toUpperCase().includes('PAGOPA')) ? (
              <>
                Non ci sono rateazioni PagoPA con i filtri selezionati.
                <br />
                Suggerimento: attiva "Includi interrotte/estinte" per visualizzare tutte le PagoPA.
              </>
            ) : (
              'Prova a modificare i criteri di ricerca.'
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Charts Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between cursor-pointer" onClick={() => toggleSection('charts')}>
          <CardTitle>Grafici</CardTitle>
          <Button variant="ghost" size="sm">
            {collapsed.charts ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
        </CardHeader>
        {!collapsed.charts && stats && (
          stats.by_type.length > 0 || stats.by_status.length > 0 || stats.cashflow.length > 0 ? (
            <CardContent className="space-y-6">
              {stats.by_type.length > 0 && <StatsByTypeChart data={stats.by_type} />}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {stats.by_status.length > 0 && <StatsByStatusPie data={stats.by_status} />}
                {stats.cashflow.length > 0 && <StatsCashflowLine data={stats.cashflow} />}
              </div>
            </CardContent>
          ) : (
            <CardContent className="py-12 text-center text-muted-foreground">
              Nessun dato disponibile con i filtri selezionati
            </CardContent>
          )
        )}
      </Card>

      {/* Tables Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between cursor-pointer" onClick={() => toggleSection('tables')}>
          <CardTitle>Tabelle</CardTitle>
          <Button variant="ghost" size="sm">
            {collapsed.tables ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
        </CardHeader>
        {!collapsed.tables && stats && (
          stats.by_status.length > 0 || stats.by_taxpayer.length > 0 || stats.cashflow.length > 0 ? (
            <CardContent>
              <StatsTables
                activeFilters={activeFilters}
                byStatus={stats.by_status}
                byTaxpayer={stats.by_taxpayer}
                cashflow={stats.cashflow}
              />
            </CardContent>
          ) : (
            <CardContent className="py-12 text-center text-muted-foreground">
              Nessun dato disponibile con i filtri selezionati
            </CardContent>
          )
        )}
      </Card>

      {/* Residual Detail Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between cursor-pointer" onClick={() => toggleSection('residualDetail')}>
          <CardTitle>Dettaglio Residui</CardTitle>
          <div className="flex items-center gap-2">
            {!collapsed.residualDetail && !residualLoading && residualRows.length > 0 && (
              <div className="flex gap-2 mr-2" onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportResidualToExcel(residualRows, activeFilters, loadResidualPrefs().groupByType)}
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Excel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportResidualToPDF(residualRows, activeFilters, loadResidualPrefs().groupByType)}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  PDF
                </Button>
              </div>
            )}
            <Button variant="ghost" size="sm">
              {collapsed.residualDetail ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        {!collapsed.residualDetail && (
          <CardContent>
            {residualError ? (
              <div className="p-6 text-center text-destructive">
                Errore: {residualError}
              </div>
            ) : residualLoading ? (
              <div className="p-6 text-center text-muted-foreground">
                Caricamento...
              </div>
            ) : (
              <ResidualDetailTable rows={residualRows} />
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
