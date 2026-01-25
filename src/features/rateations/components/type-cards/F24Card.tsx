import { FileText } from "lucide-react";
import { formatEuroFromCents } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { KpiBreakdown } from "../../api/kpi";

interface F24CardProps {
  breakdown: {
    due: KpiBreakdown;
    paid: KpiBreakdown;
    residual: KpiBreakdown;
  };
  loading?: boolean;
}

interface F24CategoryData {
  due: number;
  paid: number;
  residual: number;
}

type F24Categories = 'F24' | 'F24 Completate' | 'F24 Migrate' | 'F24 Decadute';

const CATEGORY_CONFIG: Record<F24Categories, { label: string; colorClass: string }> = {
  'F24': { label: 'Attive', colorClass: 'bg-blue-500' },
  'F24 Completate': { label: 'Completate', colorClass: 'bg-green-500' },
  'F24 Migrate': { label: 'Migrate', colorClass: 'bg-orange-500' },
  'F24 Decadute': { label: 'Decadute', colorClass: 'bg-red-500' },
};

function extractAllF24Data(breakdown: {
  due: KpiBreakdown;
  paid: KpiBreakdown;
  residual: KpiBreakdown;
}): Record<F24Categories, F24CategoryData> {
  const categories: F24Categories[] = ['F24', 'F24 Completate', 'F24 Migrate', 'F24 Decadute'];
  
  const data = {} as Record<F24Categories, F24CategoryData>;
  
  for (const cat of categories) {
    data[cat] = {
      due: breakdown.due.find(b => b.type_label === cat)?.amount_cents ?? 0,
      paid: breakdown.paid.find(b => b.type_label === cat)?.amount_cents ?? 0,
      residual: breakdown.residual.find(b => b.type_label === cat)?.amount_cents ?? 0,
    };
  }
  
  return data;
}

function hasData(catData: F24CategoryData): boolean {
  return catData.due > 0 || catData.paid > 0 || catData.residual > 0;
}

function HeaderRow() {
  return (
    <div className="grid grid-cols-[80px_1fr_1fr_1fr] gap-2 pb-1.5 mb-1 border-b text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
      <div></div>
      <div className="text-right">Dovuto</div>
      <div className="text-right">Pagato</div>
      <div className="text-right">Residuo</div>
    </div>
  );
}

interface CategoryRowProps {
  category: F24Categories;
  data: F24CategoryData;
}

function CategoryRow({ category, data }: CategoryRowProps) {
  const config = CATEGORY_CONFIG[category];
  
  if (!hasData(data)) return null;
  
  return (
    <div className="grid grid-cols-[80px_1fr_1fr_1fr] gap-2 py-1.5 text-xs items-center border-b border-border/30 last:border-0">
      <div className="flex items-center gap-1.5">
        <span className={cn("w-2 h-2 rounded-full flex-shrink-0", config.colorClass)} />
        <span className="font-medium">{config.label}</span>
      </div>
      <div className="text-right tabular-nums text-foreground">{formatEuroFromCents(data.due)}</div>
      <div className="text-right tabular-nums text-foreground">{formatEuroFromCents(data.paid)}</div>
      <div className="text-right tabular-nums text-foreground">{formatEuroFromCents(data.residual)}</div>
    </div>
  );
}

export function F24Card({ breakdown, loading = false }: F24CardProps) {
  const data = extractAllF24Data(breakdown);
  
  // Totali: Dovuto e Residuo solo Attive, Pagato include anche Completate
  const totalPaid = data['F24'].paid + data['F24 Completate'].paid;
  const activeTotals = {
    due: data['F24'].due,
    paid: totalPaid,
    residual: data['F24'].residual,
  };

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      {/* Header */}
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
        <div className="space-y-0.5">
          <HeaderRow />
          <CategoryRow category="F24" data={data['F24']} />
          <CategoryRow category="F24 Completate" data={data['F24 Completate']} />
          <CategoryRow category="F24 Migrate" data={data['F24 Migrate']} />
          <CategoryRow category="F24 Decadute" data={data['F24 Decadute']} />
          
          {/* Footer: Riepilogo Debito Attivo */}
          <div className="border-t pt-2 mt-2 space-y-1 bg-muted/30 -mx-4 px-4 py-2 rounded-b-lg">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Riepilogo Debito Attivo
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="font-medium">Totale Dovuto</span>
              <span className="font-bold tabular-nums">{formatEuroFromCents(activeTotals.due)}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Totale Pagato</span>
              <span className="tabular-nums text-foreground">{formatEuroFromCents(activeTotals.paid)}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Totale Residuo</span>
              <span className="tabular-nums font-medium">{formatEuroFromCents(activeTotals.residual)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
