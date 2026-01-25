import { RefreshCcw } from "lucide-react";
import { formatEuroFromCents } from "@/lib/formatters";
import type { KpiBreakdown } from "../../api/kpi";

interface RiamQuaterCardProps {
  breakdown: {
    due: KpiBreakdown;
    paid: KpiBreakdown;
    residual: KpiBreakdown;
  };
  loading?: boolean;
}

function extractRiamQuaterData(breakdown: KpiBreakdown) {
  return breakdown.find(b => b.type_label === 'Riam. Quater')?.amount_cents ?? 0;
}

export function RiamQuaterCard({ breakdown, loading = false }: RiamQuaterCardProps) {
  const dueCents = extractRiamQuaterData(breakdown.due);
  const paidCents = extractRiamQuaterData(breakdown.paid);
  const residualCents = extractRiamQuaterData(breakdown.residual);

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded-md bg-purple-100 dark:bg-purple-900/30">
          <RefreshCcw className="h-4 w-4 text-purple-600 dark:text-purple-400" />
        </div>
        <h3 className="font-semibold text-sm">Riammissione Quater</h3>
      </div>
      
      {loading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => (
            <div key={i} className="h-4 bg-muted animate-pulse rounded" />
          ))}
        </div>
      ) : (
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-500" />
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
          
          <div className="border-t pt-2 mt-2">
            <div className="flex justify-between items-center">
              <span className="font-medium">Residuo</span>
              <span className="font-bold tabular-nums">{formatEuroFromCents(residualCents)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
