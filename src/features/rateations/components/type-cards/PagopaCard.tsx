import { CreditCard } from "lucide-react";
import { formatEuroFromCents } from "@/lib/formatters";
import type { KpiBreakdown } from "../../api/kpi";

interface PagopaCardProps {
  breakdown: {
    due: KpiBreakdown;
    residual: KpiBreakdown;
  };
  loading?: boolean;
}

function extractPagopaData(breakdown: KpiBreakdown) {
  const attive = breakdown.find(b => b.type_label === 'PagoPa')?.amount_cents ?? 0;
  const completate = breakdown.find(b => b.type_label === 'PagoPA Completate')?.amount_cents ?? 0;
  const migrateRQ = breakdown.find(b => b.type_label === 'PagoPA Migrate RQ')?.amount_cents ?? 0;
  const migrateR5 = breakdown.find(b => b.type_label === 'PagoPA Migrate R5')?.amount_cents ?? 0;
  
  return {
    attive,
    completate,
    migrateRQ,
    migrateR5,
    totale: attive + completate + migrateRQ + migrateR5
  };
}

export function PagopaCard({ breakdown, loading = false }: PagopaCardProps) {
  const dueData = extractPagopaData(breakdown.due);
  const residualData = extractPagopaData(breakdown.residual);

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded-md bg-emerald-100 dark:bg-emerald-900/30">
          <CreditCard className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h3 className="font-semibold text-sm">PagoPA</h3>
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
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Attive
            </span>
            <span className="font-medium tabular-nums">{formatEuroFromCents(dueData.attive)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              Completate
            </span>
            <span className="font-medium tabular-nums">{formatEuroFromCents(dueData.completate)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-violet-500" />
              Migrate RQ
            </span>
            <span className="font-medium tabular-nums">{formatEuroFromCents(dueData.migrateRQ)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-500" />
              Migrate R5
            </span>
            <span className="font-medium tabular-nums">{formatEuroFromCents(dueData.migrateR5)}</span>
          </div>
          
          <div className="border-t pt-2 mt-2">
            <div className="flex justify-between items-center">
              <span className="font-medium">Totale Dovuto</span>
              <span className="font-bold tabular-nums">{formatEuroFromCents(dueData.totale)}</span>
            </div>
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Residuo</span>
              <span className="tabular-nums">{formatEuroFromCents(residualData.totale)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
