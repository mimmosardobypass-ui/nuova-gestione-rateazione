import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";
import { StatsFiltersComponent } from "./StatsFilters";
import { StatsKPI } from "./StatsKPI";
import { StatsByTypeChart } from "./StatsByTypeChart";
import { StatsByStatusPie } from "./StatsByStatusPie";
import { StatsCashflowLine } from "./StatsCashflowLine";
import { StatsTables } from "./StatsTables";
import { ExportButtons } from "./ExportButtons";
import { useStats } from "../../hooks/useStats";
import type { StatsFilters, CollapsedSections } from "../../types/stats";
import { loadFilters, saveFilters, getDefaultFilters, loadLayout, saveLayout } from "../../utils/statsFilters";

export function StatsView() {
  const [filters, setFilters] = useState<StatsFilters>(loadFilters);
  const [activeFilters, setActiveFilters] = useState<StatsFilters>(filters);
  const [collapsed, setCollapsed] = useState<CollapsedSections>(loadLayout);

  const { stats, kpis, loading, error } = useStats(activeFilters);

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
    <div className="container mx-auto p-6 space-y-6">
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
          stats.by_type.length > 0 || stats.by_status.length > 0 || stats.by_taxpayer.length > 0 || stats.cashflow.length > 0 ? (
            <CardContent>
              <StatsTables
                byType={stats.by_type}
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
    </div>
  );
}
