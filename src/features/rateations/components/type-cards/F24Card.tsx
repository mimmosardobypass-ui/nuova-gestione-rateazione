import { FileText } from "lucide-react";
import { formatEuroFromCents } from "@/lib/formatters";
import type { KpiBreakdown } from "../../api/kpi";

interface F24CardProps {
  breakdown: {
    due: KpiBreakdown;
    residual: KpiBreakdown;
  };
  loading?: boolean;
}

function extractF24Data(breakdown: KpiBreakdown) {
  const attive = breakdown.find(b => b.type_label === 'F24')?.amount_cents ?? 0;
  const completate = breakdown.find(b => b.type_label === 'F24 Completate')?.amount_cents ?? 0;
  const migrate = breakdown.find(b => b.type_label === 'F24 Migrate')?.amount_cents ?? 0;
  const inAttesa = breakdown.find(b => b.type_label === 'F24 In Attesa')?.amount_cents ?? 0;
  
  return {
    attive,
    completate,
    migrate,
    inAttesa,
    // Totale dovuto: solo Attive + In Attesa (Completate e Migrate non sono più debiti F24)
    totaleDebito: attive + inAttesa,
    // Totale storico per riferimento
    totaleStorico: attive + completate + migrate + inAttesa
  };
}

export function F24Card({ breakdown, loading = false }: F24CardProps) {
  const dueData = extractF24Data(breakdown.due);
  const residualData = extractF24Data(breakdown.residual);

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded-md bg-blue-100 dark:bg-blue-900/30">
          <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        </div>
        <h3 className="font-semibold text-sm">F24</h3>
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
              <span className="w-2 h-2 rounded-full bg-blue-500" />
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
              <span className="w-2 h-2 rounded-full bg-orange-500" />
              Migrate
            </span>
            <span className="font-medium tabular-nums">{formatEuroFromCents(dueData.migrate)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-yellow-500" />
              In Attesa
            </span>
            <span className="font-medium tabular-nums">{formatEuroFromCents(dueData.inAttesa)}</span>
          </div>
          
          <div className="border-t pt-2 mt-2">
            <div className="flex justify-between items-center">
              <span className="font-medium">Debito F24</span>
              <span className="font-bold tabular-nums">{formatEuroFromCents(dueData.totaleDebito)}</span>
            </div>
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Residuo</span>
              <span className="tabular-nums">{formatEuroFromCents(residualData.totaleDebito)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
