import { Leaf } from "lucide-react";
import { formatEuro, formatEuroFromCents } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { KpiBreakdown } from "../../api/kpi";

interface RottamazioniCardProps {
  breakdown: {
    due: KpiBreakdown;
    paid: KpiBreakdown;
    residual: KpiBreakdown;
  };
  savingRQ: number; // Already in EUR from useQuaterSaving
  savingR5: number; // Already in EUR from useQuinquiesSaving
  loading?: boolean;
}

type RottamazioneType = 'Rottamazione Quater' | 'Riam. Quater' | 'Rottamazione Quinquies';

const TYPE_CONFIG: Record<RottamazioneType, { 
  label: string; 
  colorClass: string;
  showSaving: boolean;
}> = {
  'Rottamazione Quater': { 
    label: 'Quater', 
    colorClass: 'bg-amber-500',
    showSaving: true 
  },
  'Riam. Quater': { 
    label: 'Riam. Quater', 
    colorClass: 'bg-purple-500',
    showSaving: false 
  },
  'Rottamazione Quinquies': { 
    label: 'Quinquies', 
    colorClass: 'bg-violet-500',
    showSaving: true 
  },
};

interface TypeData {
  due: number;
  paid: number;
  residual: number;
}

function extractTypeData(breakdown: KpiBreakdown, typeLabel: RottamazioneType): number {
  return breakdown.find(b => b.type_label === typeLabel)?.amount_cents ?? 0;
}

interface TypeRowProps {
  type: RottamazioneType;
  data: TypeData;
  saving?: number;
}

function TypeRow({ type, data, saving }: TypeRowProps) {
  const config = TYPE_CONFIG[type];
  const hasData = data.due > 0 || data.paid > 0 || data.residual > 0 || (saving && saving > 0);
  
  if (!hasData) return null;
  
  return (
    <div className="space-y-1 py-2 border-b border-border/30 last:border-0">
      {/* Row: Type label + financial data */}
      <div className="flex items-center gap-3 text-xs">
        <div className="flex items-center gap-1.5 min-w-[80px]">
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
      
      {/* Row: Risparmio (if applicable) */}
      {config.showSaving && saving !== undefined && (
        <div className="flex items-center gap-1 pl-[92px] text-xs">
          <span className="text-emerald-600 dark:text-emerald-400 text-[10px]">Risparmio</span>
          <span className="tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
            {formatEuro(saving)}
          </span>
        </div>
      )}
    </div>
  );
}

export function RottamazioniCard({ breakdown, savingRQ, savingR5, loading = false }: RottamazioniCardProps) {
  const types: RottamazioneType[] = ['Rottamazione Quater', 'Riam. Quater', 'Rottamazione Quinquies'];
  
  const dataByType: Record<RottamazioneType, TypeData> = {} as Record<RottamazioneType, TypeData>;
  for (const type of types) {
    dataByType[type] = {
      due: extractTypeData(breakdown.due, type),
      paid: extractTypeData(breakdown.paid, type),
      residual: extractTypeData(breakdown.residual, type),
    };
  }
  
  const getSaving = (type: RottamazioneType): number | undefined => {
    if (type === 'Rottamazione Quater') return savingRQ;
    if (type === 'Rottamazione Quinquies') return savingR5;
    return undefined;
  };

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded-md bg-amber-100 dark:bg-amber-900/30">
          <Leaf className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        </div>
        <h3 className="font-semibold text-sm">Rottamazioni</h3>
      </div>
      
      {loading ? (
        <div className="space-y-2">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="h-4 bg-muted animate-pulse rounded" />
          ))}
        </div>
      ) : (
        <div className="space-y-0">
          {types.map(type => (
            <TypeRow 
              key={type} 
              type={type} 
              data={dataByType[type]} 
              saving={getSaving(type)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
