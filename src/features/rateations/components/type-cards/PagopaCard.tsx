import { CreditCard } from "lucide-react";
import { formatEuroFromCents } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { KpiBreakdown } from "../../api/kpi";

interface PagopaCardProps {
  breakdown: {
    due: KpiBreakdown;
    residual: KpiBreakdown;
  };
  loading?: boolean;
}

type PagopaCategory = 'PagoPa' | 'PagoPA Completate' | 'PagoPA Migrate RQ' | 'PagoPA Migrate R5';

const CATEGORY_CONFIG: Record<PagopaCategory, { label: string; colorClass: string }> = {
  'PagoPa': { label: 'Attive', colorClass: 'bg-emerald-500' },
  'PagoPA Completate': { label: 'Completate', colorClass: 'bg-green-500' },
  'PagoPA Migrate RQ': { label: 'Migrate RQ', colorClass: 'bg-violet-500' },
  'PagoPA Migrate R5': { label: 'Migrate R5', colorClass: 'bg-indigo-500' },
};

interface CategoryData {
  due: number;
  residual: number;
}

function extractAllPagopaData(breakdown: {
  due: KpiBreakdown;
  residual: KpiBreakdown;
}): Record<PagopaCategory, CategoryData> {
  const categories: PagopaCategory[] = ['PagoPa', 'PagoPA Completate', 'PagoPA Migrate RQ', 'PagoPA Migrate R5'];
  
  const data = {} as Record<PagopaCategory, CategoryData>;
  
  for (const cat of categories) {
    data[cat] = {
      due: breakdown.due.find(b => b.type_label === cat)?.amount_cents ?? 0,
      residual: breakdown.residual.find(b => b.type_label === cat)?.amount_cents ?? 0,
    };
  }
  
  return data;
}

function hasData(catData: CategoryData): boolean {
  return catData.due > 0 || catData.residual > 0;
}

function HeaderRow() {
  return (
    <div className="grid grid-cols-[100px_1fr_1fr] gap-2 pb-1.5 mb-1 border-b text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
      <div></div>
      <div className="text-right">Dovuto</div>
      <div className="text-right">Residuo</div>
    </div>
  );
}

interface CategoryRowProps {
  category: PagopaCategory;
  data: CategoryData;
}

function CategoryRow({ category, data }: CategoryRowProps) {
  const config = CATEGORY_CONFIG[category];
  
  if (!hasData(data)) return null;
  
  return (
    <div className="grid grid-cols-[100px_1fr_1fr] gap-2 py-1.5 text-xs items-center border-b border-border/30 last:border-0">
      <div className="flex items-center gap-1.5">
        <span className={cn("w-2 h-2 rounded-full flex-shrink-0", config.colorClass)} />
        <span className="font-medium">{config.label}</span>
      </div>
      <div className="text-right tabular-nums text-foreground">{formatEuroFromCents(data.due)}</div>
      <div className="text-right tabular-nums text-foreground">{formatEuroFromCents(data.residual)}</div>
    </div>
  );
}

export function PagopaCard({ breakdown, loading = false }: PagopaCardProps) {
  const data = extractAllPagopaData(breakdown);
  
  // Calculate totals
  const totalDue = Object.values(data).reduce((sum, d) => sum + d.due, 0);
  const totalResidual = Object.values(data).reduce((sum, d) => sum + d.residual, 0);

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
        <div className="space-y-0.5">
          <HeaderRow />
          
          <CategoryRow category="PagoPa" data={data['PagoPa']} />
          <CategoryRow category="PagoPA Completate" data={data['PagoPA Completate']} />
          <CategoryRow category="PagoPA Migrate RQ" data={data['PagoPA Migrate RQ']} />
          <CategoryRow category="PagoPA Migrate R5" data={data['PagoPA Migrate R5']} />
          
          {/* Footer: Riepilogo */}
          <div className="border-t pt-2 mt-2 space-y-1 bg-muted/30 -mx-4 px-4 py-2 rounded-b-lg">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Riepilogo
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="font-medium">Totale Dovuto</span>
              <span className="font-bold tabular-nums">{formatEuroFromCents(totalDue)}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Totale Residuo</span>
              <span className="tabular-nums font-medium">{formatEuroFromCents(totalResidual)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
