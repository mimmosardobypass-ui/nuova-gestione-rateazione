import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, ArrowLeft, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStatsV3, type StatsV3Filters } from "../../hooks/useStatsV3";
import { StatsV3KPIs } from "./StatsV3KPIs";
import { StatsV3Filters as FiltersComponent } from "./StatsV3Filters";
import { StatsV3Charts } from "./StatsV3Charts";
import { StatsV3Table } from "./StatsV3Table";
import { StatsV3Export } from "./StatsV3Export";
import { MonthlyTrendMatrix } from "./MonthlyTrendMatrix";
import { MonthBreakdownDrawer } from "./MonthBreakdownDrawer";

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
  const navigate = useNavigate();
  
  // Monthly breakdown drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<{ y: number | null; m: number | null }>({ 
    y: null, 
    m: null 
  });
  
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

  // Calculate year range for monthly matrix
  const currentYear = new Date().getFullYear();
  const yearFrom = filters.dateFrom ? new Date(filters.dateFrom).getFullYear() : 2021;
  const yearTo = filters.dateTo ? new Date(filters.dateTo).getFullYear() : currentYear;

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
      {/* Navigation */}
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => navigate("/")}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Torna alla Home
        </Button>
        
        <div className="text-sm text-muted-foreground">
          <span className="cursor-pointer hover:text-foreground" onClick={() => navigate("/")}>Home</span>
          <span className="mx-2">/</span>
          <span className="font-medium text-foreground">Statistiche Avanzate V3</span>
        </div>
      </div>

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

      {/* Monthly Trend Matrix */}
      {loading ? (
        <Skeleton className="h-[500px]" />
      ) : data ? (
        <>
          <MonthlyTrendMatrix
            yearFrom={yearFrom}
            yearTo={yearTo}
            onSelectMonth={(y, m) => {
              setSelectedMonth({ y, m });
              setDrawerOpen(true);
            }}
          />
          
          {/* Link to full-screen evolution chart */}
          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={() => navigate(`/evoluzione-mensile?from=${yearFrom}&to=${yearTo}`)}
              className="gap-2"
            >
              <TrendingUp className="h-4 w-4" />
              Vedi Evoluzione Mensile Full-Screen
            </Button>
          </div>
        </>
      ) : null}

      {/* Month Breakdown Drawer */}
      <MonthBreakdownDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        year={selectedMonth.y}
        month={selectedMonth.m}
      />

      {/* Table */}
      {loading ? (
        <Skeleton className="h-[600px]" />
      ) : data ? (
        <StatsV3Table details={data.details} />
      ) : null}
    </div>
  );
}
