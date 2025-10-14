import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { useStatsV3, type StatsV3Filters } from "../../hooks/useStatsV3";
import { StatsV3KPIs } from "./StatsV3KPIs";
import { StatsV3Filters as FiltersComponent } from "./StatsV3Filters";
import { StatsV3Charts } from "./StatsV3Charts";
import { StatsV3Table } from "./StatsV3Table";
import { StatsV3Export } from "./StatsV3Export";

const DEFAULT_FILTERS: StatsV3Filters = {
  dateFrom: null,
  dateTo: null,
  types: null,
  statuses: null,
  includeInterrupted: true,
  includeDecayed: true,
  groupBy: 'due',
};

export default function StatsV3View() {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Initialize filters from URL
  const [filters, setFilters] = useState<StatsV3Filters>(() => {
    const typesParam = searchParams.get("types");
    const statusesParam = searchParams.get("statuses");
    
    return {
      dateFrom: searchParams.get("from"),
      dateTo: searchParams.get("to"),
      types: typesParam ? typesParam.split(",") : null,
      statuses: statusesParam ? statusesParam.split(",") : null,
      includeInterrupted: searchParams.get("incInt") === "1",
      includeDecayed: searchParams.get("incDec") === "1",
      groupBy: (searchParams.get("gb") as 'due' | 'created') || 'due',
    };
  });

  const { data, loading, error } = useStatsV3(filters);

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.dateFrom) params.set("from", filters.dateFrom);
    if (filters.dateTo) params.set("to", filters.dateTo);
    if (filters.types && filters.types.length > 0) params.set("types", filters.types.join(","));
    if (filters.statuses && filters.statuses.length > 0) params.set("statuses", filters.statuses.join(","));
    if (filters.includeInterrupted) params.set("incInt", "1");
    if (filters.includeDecayed) params.set("incDec", "1");
    params.set("gb", filters.groupBy);
    
    setSearchParams(params, { replace: true });
  }, [filters, setSearchParams]);

  const handleApplyFilters = (newFilters: StatsV3Filters) => {
    setFilters(newFilters);
  };

  const handleResetFilters = () => {
    setFilters(DEFAULT_FILTERS);
  };

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Errore nel caricamento delle statistiche: {error}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Statistiche Avanzate V3</h1>
          <p className="text-muted-foreground mt-1">
            Dashboard completa con analisi approfondita delle rateazioni
          </p>
        </div>
        {data && <StatsV3Export data={data} filters={filters} />}
      </div>

      {/* Filters */}
      <FiltersComponent
        filters={filters}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
      />

      {/* KPIs */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : data ? (
        <StatsV3KPIs kpis={data.kpis} />
      ) : null}

      {/* Charts */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-[400px]" />
          <Skeleton className="h-[400px]" />
        </div>
      ) : data ? (
        <StatsV3Charts byType={data.by_type} series={data.series} />
      ) : null}

      {/* Table */}
      {loading ? (
        <Skeleton className="h-[600px]" />
      ) : data ? (
        <StatsV3Table details={data.details} />
      ) : null}
    </div>
  );
}
