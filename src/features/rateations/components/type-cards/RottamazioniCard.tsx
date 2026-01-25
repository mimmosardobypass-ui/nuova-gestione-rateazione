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
    showSaving: false 
  },
  'Riam. Quater': { 
    label: 'Riam. Quater', 
    colorClass: 'bg-purple-500',
    showSaving: true 
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

function HeaderRow() {
  return (
    <div className="grid grid-cols-[100px_1fr_1fr_1fr] gap-2 pb-1.5 mb-1 border-b text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
      <div></div>
      <div className="text-right">Dovuto</div>
      <div className="text-right">Pagato</div>
      <div className="text-right">Residuo</div>
    </div>
  );
}

interface TypeRowProps {
  type: RottamazioneType;
  data: TypeData;
  saving?: number;
  forceShow?: boolean;
}

function TypeRow({ type, data, saving, forceShow = false }: TypeRowProps) {
  const config = TYPE_CONFIG[type];
  const hasData = data.due > 0 || data.paid > 0 || data.residual > 0 || (saving && saving > 0);
  
  if (!hasData && !forceShow) return null;
  
  return (
    <>
      <div className="grid grid-cols-[100px_1fr_1fr_1fr] gap-2 py-1.5 text-xs items-center border-b border-border/30">
        <div className="flex items-center gap-1.5">
          <span className={cn("w-2 h-2 rounded-full flex-shrink-0", config.colorClass)} />
          <span className="font-medium">{config.label}</span>
        </div>
        <div className="text-right tabular-nums text-foreground">{formatEuroFromCents(data.due)}</div>
        <div className="text-right tabular-nums text-foreground">{formatEuroFromCents(data.paid)}</div>
        <div className="text-right tabular-nums text-foreground">{formatEuroFromCents(data.residual)}</div>
      </div>
      
      {/* Risparmio row (indented) */}
      {config.showSaving && saving !== undefined && saving > 0 && (
        <div className="grid grid-cols-[100px_1fr_1fr_1fr] gap-2 py-1 text-xs items-center border-b border-border/30 last:border-0">
          <div className="flex items-center gap-1.5 pl-4">
            <span className="text-emerald-600 dark:text-emerald-400 text-[10px]">└─ Risparmio</span>
          </div>
          <div></div>
          <div></div>
          <div className="text-right tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
            {formatEuro(saving)}
          </div>
        </div>
      )}
    </>
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
    if (type === 'Riam. Quater') return savingRQ;
    if (type === 'Rottamazione Quinquies') return savingR5;
    return undefined;
  };
  
  const totals = types.reduce(
    (acc, type) => ({
      due: acc.due + dataByType[type].due,
      paid: acc.paid + dataByType[type].paid,
      residual: acc.residual + dataByType[type].residual,
    }),
    { due: 0, paid: 0, residual: 0 }
  );

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
          <HeaderRow />
          {types.map(type => (
            <TypeRow 
              key={type} 
              type={type} 
              data={dataByType[type]} 
              saving={getSaving(type)}
              forceShow={type === 'Rottamazione Quinquies'}
            />
          ))}
          {/* Totals row */}
          <div className="grid grid-cols-[100px_1fr_1fr_1fr] gap-2 pt-2 mt-1 border-t-2 border-border text-xs items-center">
            <div className="font-semibold text-muted-foreground">Totale</div>
            <div className="text-right tabular-nums font-bold">{formatEuroFromCents(totals.due)}</div>
            <div className="text-right tabular-nums font-bold">{formatEuroFromCents(totals.paid)}</div>
            <div className="text-right tabular-nums font-bold">{formatEuroFromCents(totals.residual)}</div>
          </div>
        </div>
      )}
    </div>
  );
}
