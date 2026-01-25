import { useState } from "react";
import { FileText, ChevronDown } from "lucide-react";
import { formatEuroFromCents } from "@/lib/formatters";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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

type F24Categories = 'F24' | 'F24 Completate' | 'F24 Migrate' | 'F24 In Attesa' | 'F24 Decadute' | 'F24 Interrotte';

const CATEGORY_CONFIG: Record<F24Categories, { label: string; colorClass: string }> = {
  'F24': { label: 'Attive', colorClass: 'bg-blue-500' },
  'F24 Completate': { label: 'Completate', colorClass: 'bg-green-500' },
  'F24 Migrate': { label: 'Migrate', colorClass: 'bg-orange-500' },
  'F24 In Attesa': { label: 'In Attesa', colorClass: 'bg-yellow-500' },
  'F24 Decadute': { label: 'Decadute', colorClass: 'bg-red-500' },
  'F24 Interrotte': { label: 'Interrotte', colorClass: 'bg-purple-500' },
};

function extractAllF24Data(breakdown: {
  due: KpiBreakdown;
  paid: KpiBreakdown;
  residual: KpiBreakdown;
}): Record<F24Categories, F24CategoryData> {
  const categories: F24Categories[] = ['F24', 'F24 Completate', 'F24 Migrate', 'F24 In Attesa', 'F24 Decadute', 'F24 Interrotte'];
  
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

interface CategoryRowProps {
  category: F24Categories;
  data: F24CategoryData;
}

function CategoryRow({ category, data }: CategoryRowProps) {
  const config = CATEGORY_CONFIG[category];
  const hasData = data.due > 0 || data.paid > 0 || data.residual > 0;
  
  if (!hasData) return null;
  
  return (
    <div className="flex items-center gap-3 py-1.5 text-xs border-b border-border/30 last:border-0">
      <div className="flex items-center gap-1.5 min-w-[72px]">
        <span className={cn("w-2 h-2 rounded-full flex-shrink-0", config.colorClass)} />
        <span className="font-medium">{config.label}</span>
      </div>
      <div className="flex items-center gap-1 text-muted-foreground">
        <span className="text-[10px]">Dovuto</span>
        <span className="tabular-nums font-medium text-foreground">{formatEuroFromCents(data.due)}</span>
      </div>
      <div className="flex items-center gap-1 text-muted-foreground">
        <span className="text-[10px]">Pagato</span>
        <span className="tabular-nums text-green-600 dark:text-green-400">{formatEuroFromCents(data.paid)}</span>
      </div>
      <div className="flex items-center gap-1 text-muted-foreground">
        <span className="text-[10px]">Res</span>
        <span className="tabular-nums">{formatEuroFromCents(data.residual)}</span>
      </div>
    </div>
  );
}

interface CollapsibleSectionProps {
  title: string;
  categories: F24Categories[];
  data: Record<F24Categories, F24CategoryData>;
  defaultOpen?: boolean;
}

function CollapsibleSection({ title, categories, data, defaultOpen = true }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  // Check if any category has data
  const hasAnyData = categories.some(cat => {
    const catData = data[cat];
    return catData.due > 0 || catData.paid > 0 || catData.residual > 0;
  });
  
  if (!hasAnyData) return null;
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center gap-1.5 w-full py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors">
        <ChevronDown className={cn("h-3 w-3 transition-transform", isOpen && "rotate-180")} />
        {title}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pl-1">
          {categories.map(cat => (
            <CategoryRow key={cat} category={cat} data={data[cat]} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function F24Card({ breakdown, loading = false }: F24CardProps) {
  const data = extractAllF24Data(breakdown);
  
  // Totali solo per F24 Attive
  const activeTotals = data['F24'];

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
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="h-4 bg-muted animate-pulse rounded" />
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          
          {/* Sezione: Debito Attivo */}
          <CollapsibleSection 
            title="Debito Attivo"
            categories={['F24']}
            data={data}
            defaultOpen={true}
          />
          
          {/* Sezione: Storico / Migrato */}
          <CollapsibleSection 
            title="Storico / Migrato"
            categories={['F24 Completate', 'F24 Migrate', 'F24 In Attesa']}
            data={data}
            defaultOpen={false}
          />
          
          {/* Sezione: Decadute / Interrotte */}
          <CollapsibleSection 
            title="Decadute / Interrotte"
            categories={['F24 Decadute', 'F24 Interrotte']}
            data={data}
            defaultOpen={false}
          />
          
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
              <span className="tabular-nums text-green-600 dark:text-green-400">{formatEuroFromCents(activeTotals.paid)}</span>
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
