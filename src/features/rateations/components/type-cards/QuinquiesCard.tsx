import { Sprout } from "lucide-react";
import { formatEuro, formatEuroFromCents } from "@/lib/formatters";
import type { KpiBreakdown } from "../../api/kpi";

interface QuinquiesCardProps {
  breakdown: {
    due: KpiBreakdown;
    paid: KpiBreakdown;
    residual: KpiBreakdown;
  };
  saving: number; // Already in EUR from useQuinquiesSaving
  loading?: boolean;
}

function extractQuinquiesData(breakdown: KpiBreakdown) {
  return breakdown.find(b => b.type_label === 'Rottamazione Quinquies')?.amount_cents ?? 0;
}

export function QuinquiesCard({ breakdown, saving, loading = false }: QuinquiesCardProps) {
  const dueCents = extractQuinquiesData(breakdown.due);
  const paidCents = extractQuinquiesData(breakdown.paid);
  const residualCents = extractQuinquiesData(breakdown.residual);

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded-md bg-violet-100 dark:bg-violet-900/30">
          <Sprout className="h-4 w-4 text-violet-600 dark:text-violet-400" />
        </div>
        <h3 className="font-semibold text-sm">Rottamazione Quinquies</h3>
      </div>
      
      {loading ? (
        <div className="space-y-2">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-4 bg-muted animate-pulse rounded" />
          ))}
        </div>
      ) : (
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-violet-500" />
              Dovuto
            </span>
            <span className="font-medium tabular-nums">{formatEuroFromCents(dueCents)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              Pagato
            </span>
            <span className="font-medium tabular-nums">{formatEuroFromCents(paidCents)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              Residuo
            </span>
            <span className="font-medium tabular-nums">{formatEuroFromCents(residualCents)}</span>
          </div>
          
          <div className="border-t pt-2 mt-2">
            <div className="flex justify-between items-center">
              <span className="font-medium text-emerald-600 dark:text-emerald-400">Risparmio</span>
              <span className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatEuro(saving)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
