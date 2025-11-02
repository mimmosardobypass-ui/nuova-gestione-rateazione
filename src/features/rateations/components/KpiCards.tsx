import React from "react";
import { formatEuro } from "@/lib/formatters";
import { Sparkline } from "@/components/ui/sparkline";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";

function Kpi({ 
  label, 
  value, 
  loading, 
  sparklineData,
  tooltip
}: { 
  label: string; 
  value: number; 
  loading: boolean; 
  sparklineData?: Array<{ month: string; paid: number; due: number }>;
  tooltip?: string;
}) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span>{label}</span>
        {tooltip && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-xs">{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <div className="mt-2 text-xl font-semibold">
        {loading ? "—" : formatEuro(value)}
      </div>
      {sparklineData && (
        <div className="mt-3">
          <Sparkline data={sparklineData} loading={loading} />
        </div>
      )}
    </div>
  );
}

export function KpiCards({
  loading,
  stats,
  previousStats,
}: {
  loading: boolean;
  stats: { 
    total_due: number; 
    total_paid: number; 
    total_residual: number; 
    total_late: number;
    series: {
      last12: {
        months: string[];
        paid: number[];
        due: number[];
        residual: number[];
        late: number[];
      };
    };
  };
  previousStats?: { 
    total_due: number; 
    total_paid: number; 
    total_residual: number; 
    total_late: number;
    series?: {
      last12: {
        months: string[];
        paid: number[];
        due: number[];
        residual: number[];
        late: number[];
      };
    };
  } | null;
}) {
  const display = loading && previousStats ? previousStats : stats;
  const showLoading = loading && !previousStats;
  
  // Prepare sparkline data from series
  const sparklineData = display.series?.last12 ? display.series.last12.months.map((month, index) => ({
    month,
    paid: display.series!.last12.paid[index] || 0,
    due: display.series!.last12.due[index] || 0
  })) : [];
  
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Kpi 
        label="Totale dovuto" 
        value={display.total_due} 
        loading={showLoading} 
        sparklineData={sparklineData}
        tooltip="Totale dovuto effettivo (esclude PagoPA interrotte già migrate a Rottamazione Quater)"
      />
      <Kpi 
        label="Totale pagato" 
        value={display.total_paid} 
        loading={showLoading} 
        sparklineData={sparklineData}
      />
      <Kpi 
        label="Totale residuo" 
        value={display.total_residual} 
        loading={showLoading} 
        sparklineData={sparklineData}
        tooltip="Residuo effettivo da pagare (esclude PagoPA interrotte già migrate a Rottamazione Quater)"
      />
      <Kpi 
        label="In ritardo" 
        value={display.total_late} 
        loading={showLoading} 
        sparklineData={sparklineData}
        tooltip="Importo in ritardo effettivo (esclude rate di PagoPA già migrate a Rottamazione Quater)"
      />
    </section>
  );
}