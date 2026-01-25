import React from "react";
import { formatEuro, formatEuroFromCents } from "@/lib/formatters";
import { Sparkline } from "@/components/ui/sparkline";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import type { KpiBreakdown, KpiBreakdownItem } from "../api/kpi";

// Tipi che devono apparire sempre nei breakdown, anche con €0,00
const ALWAYS_SHOW_TYPES = [
  'Rottamazione Quinquies',
  'F24 Migrate',
  'F24 In Attesa',
  'F24 Completate',
  'PagoPA Migrate RQ',
  'PagoPA Migrate R5',
  'PagoPA Completate',
];

// Garantisce che i tipi obbligatori siano sempre presenti nel breakdown
function ensureRequiredTypes(breakdown: KpiBreakdown): KpiBreakdown {
  const existingTypes = new Set(breakdown.map(item => item.type_label));
  const result = [...breakdown];
  
  for (const type of ALWAYS_SHOW_TYPES) {
    if (!existingTypes.has(type)) {
      result.push({ type_label: type, amount_cents: 0 });
    }
  }
  
  return result;
}

function Kpi({ 
  label, 
  value, 
  loading, 
  sparklineData,
  tooltip,
  breakdown
}: { 
  label: string; 
  value: number; 
  loading: boolean; 
  sparklineData?: Array<{ month: string; paid: number; due: number }>;
  tooltip?: string;
  breakdown?: KpiBreakdown;
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
      
      {/* Breakdown per tipo */}
      {!loading && breakdown && (
        <div className="mt-3 space-y-1 text-xs border-t pt-2">
          {ensureRequiredTypes(breakdown)
            .filter(item => item.amount_cents > 0 || ALWAYS_SHOW_TYPES.includes(item.type_label))
            .sort((a, b) => {
              const typeOrder: Record<string, number> = {
                // F24
                'F24': 1,
                'F24 Completate': 2,
                'F24 Migrate': 3,
                'F24 In Attesa': 4,
                // PagoPA
                'PagoPa': 5,
                'PagoPA Completate': 6,
                'PagoPA Migrate RQ': 7,
                'PagoPA Migrate R5': 8,
                // Altri
                'Rottamazione Quater': 9,
                'Rottamazione Quinquies': 10,
                'Riam. Quater': 11,
                'Altro': 99,
              };
              const orderA = typeOrder[a.type_label] ?? 999;
              const orderB = typeOrder[b.type_label] ?? 999;
              return orderA - orderB;
            })
            .map(item => (
              <div key={item.type_label} className="flex justify-between items-center">
                <span className="text-muted-foreground">{item.type_label}:</span>
                <span className="font-medium tabular-nums">
                  {formatEuroFromCents(item.amount_cents)}
                </span>
              </div>
            ))}
        </div>
      )}
      
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
    breakdown_by_type: {
      due: KpiBreakdown;
      paid: KpiBreakdown;
      residual: KpiBreakdown;
      overdue: KpiBreakdown;
    };
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
    breakdown_by_type?: {
      due: KpiBreakdown;
      paid: KpiBreakdown;
      residual: KpiBreakdown;
      overdue: KpiBreakdown;
    };
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
        breakdown={display.breakdown_by_type?.due}
        tooltip="Totale dovuto delle rateazioni attive e F24 decadute in attesa di cartella (esclude PagoPA interrotte già migrate a RQ)"
      />
      <Kpi 
        label="Totale pagato" 
        value={display.total_paid} 
        loading={showLoading} 
        sparklineData={sparklineData}
        breakdown={display.breakdown_by_type?.paid}
      />
      <Kpi 
        label="Totale residuo" 
        value={display.total_residual} 
        loading={showLoading} 
        sparklineData={sparklineData}
        breakdown={display.breakdown_by_type?.residual}
        tooltip="Residuo da pagare su rateazioni attive e F24 decadute non agganciate (esclude PagoPA interrotte già migrate a RQ)"
      />
      <Kpi 
        label="In ritardo" 
        value={display.total_late} 
        loading={showLoading} 
        sparklineData={sparklineData}
        breakdown={display.breakdown_by_type?.overdue}
        tooltip="Importo in ritardo su rateazioni attive (esclude PagoPA interrotte già migrate a RQ)"
      />
    </section>
  );
}