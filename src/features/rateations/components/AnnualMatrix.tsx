import React, { useMemo, useState } from 'react';
import { ArrowLeft, ArrowDown, ArrowUp, Download, Printer } from 'lucide-react';
import { useMonthlyMatrix } from '@/features/rateations/hooks/useMonthlyMatrix';
import type { MetricType } from '@/features/rateations/types/monthly-matrix';
import { formatEuro } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PrintService } from '@/utils/printUtils';

const MONTH_NAMES = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'] as const;

const METRIC_LABELS: Record<MetricType, string> = {
  due: 'Dovuto',
  paid: 'Pagato',
  overdue: 'In ritardo',
  extra_ravv: 'Ravvedimento',
};

// ---- Helper functions (defined before use to avoid TDZ) ----
function getMetricValue(monthData: any, metric: MetricType): number {
  switch (metric) {
    case 'due': return Number(monthData?.due_amount || 0);
    case 'paid': return Number(monthData?.paid_amount || 0);
    case 'overdue': return Number(monthData?.overdue_amount || 0);
    case 'extra_ravv': return Number(monthData?.extra_ravv_amount || 0);
    default: return 0;
  }
}

function buildHeat(value: number, max: number): string {
  if (!max || !Number.isFinite(max)) return 'bg-muted/20';
  const r = Math.max(0, Math.min(1, value / max)); // clamp 0..1
  if (r === 0) return 'bg-muted/20';
  if (r <= 0.2) return 'bg-primary/20';
  if (r <= 0.4) return 'bg-primary/40';
  if (r <= 0.6) return 'bg-primary/60';
  if (r <= 0.8) return 'bg-primary/80';
  return 'bg-primary';
}

type Props = { onBack?: () => void };

export default function AnnualMatrix({ onBack }: Props) {
  const { data, years, loading, error } = useMonthlyMatrix();
  const [metric, setMetric] = useState<MetricType>('paid');     // default più "parlante"
  const [showYoY, setShowYoY] = useState(false);

  const maxValue = useMemo(() => {
    let max = 0;
    years.forEach(y => {
      for (let m = 1; m <= 12; m++) {
        const v = getMetricValue(data[y]?.[m], metric);
        if (v > max) max = v;
      }
    });
    return max;
  }, [data, years, metric]);

  const yoyChange = (y: number, m: number): number | null => {
    const prev = y - 1;
    if (!data[prev]) return null;
    const curVal = getMetricValue(data[y][m], metric);
    const prevVal = getMetricValue(data[prev][m], metric);
    if (prevVal === 0) return curVal > 0 ? 100 : 0;
    return ((curVal - prevVal) / prevVal) * 100;
  };

  const exportCSV = () => {
    const rows: string[] = [];
    rows.push(['Anno', ...MONTH_NAMES, 'Totale'].join(';'));

    // righe per anno
    years.forEach((y) => {
      let tot = 0;
      const line = [String(y)];
      for (let m = 1; m <= 12; m++) {
        const v = getMetricValue(data[y][m], metric);
        tot += v;
        line.push(v.toLocaleString('it-IT', { minimumFractionDigits: 2 }));
      }
      line.push(tot.toLocaleString('it-IT', { minimumFractionDigits: 2 }));
      rows.push(line.join(';'));
    });

    // riga TOTALE (usa columnTotals esistente)
    rows.push(
      ['TOTALE', ...columnTotals.map(v => v.toLocaleString('it-IT', { minimumFractionDigits: 2 })), grandTotal.toLocaleString('it-IT', { minimumFractionDigits: 2 })]
        .join(';')
    );

    // riga MEDIA (usa columnAverages esistente)
    rows.push(
      ['MEDIA', ...columnAverages.map(v => v.toLocaleString('it-IT', { minimumFractionDigits: 2 })), grandAverage.toLocaleString('it-IT', { minimumFractionDigits: 2 })]
        .join(';')
    );

    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `matrice-${METRIC_LABELS[metric].toLowerCase()}-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <Card>
        <CardHeader><CardTitle>Comparazione annuale</CardTitle></CardHeader>
        <CardContent>Caricamento matrice…</CardContent>
      </Card>
    );
  }
  if (error) {
    return (
      <Card>
        <CardHeader><CardTitle>Comparazione annuale</CardTitle></CardHeader>
        <CardContent>Errore: {error}</CardContent>
      </Card>
    );
  }
  if (years.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Comparazione annuale</CardTitle>
        </CardHeader>
        <CardContent>Nessun dato disponibile.</CardContent>
      </Card>
    );
  }

  // Totali finali colonna "TOTALE" e righe "TOT/MEDIA" con ottimizzazioni prestazioni
  const columnTotals = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      return years.reduce((s, y) => s + getMetricValue(data[y][m], metric), 0);
    }),
    [years, data, metric]
  );

  const grandTotal = useMemo(
    () => columnTotals.reduce((s, v) => s + v, 0),
    [columnTotals]
  );

  const columnAverages = useMemo(
    () => columnTotals.map(t => (years.length ? t / years.length : 0)),
    [columnTotals, years.length]
  );

  const grandAverage = useMemo(
    () => (years.length ? grandTotal / years.length : 0),
    [grandTotal, years.length]
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          {onBack && <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft /></Button>}
          <CardTitle>Matrice annuale – {METRIC_LABELS[metric]}</CardTitle>
        </div>
        <div className="flex items-center gap-2">
          <Button variant={showYoY ? 'default' : 'outline'} onClick={() => setShowYoY(v => !v)}>YoY</Button>
          <Button variant="outline" onClick={exportCSV}><Download className="mr-2 h-4 w-4" />CSV</Button>
          <Button variant="outline" onClick={() => PrintService.openRiepilogoPreview()}><Printer className="mr-2 h-4 w-4" />Stampa</Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Selettore metrica */}
        <div className="flex flex-wrap gap-2">
          {(['paid','due','overdue','extra_ravv'] as MetricType[]).map(m => (
            <Button key={m}
              variant={metric === m ? 'default' : 'outline'}
              onClick={() => setMetric(m)}>
              {METRIC_LABELS[m]}
            </Button>
          ))}
        </div>

        {/* Header mesi */}
        <div className="grid" style={{ gridTemplateColumns: '100px repeat(12, minmax(64px, 1fr)) 120px' }}>
          <div className="sticky left-0 bg-background z-10 text-sm font-medium text-muted-foreground">Anno</div>
          {MONTH_NAMES.map((mn) => (
            <div key={mn} className="text-center text-sm font-medium text-muted-foreground">{mn}</div>
          ))}
          <div className="text-right text-sm font-medium text-muted-foreground">Totale</div>
        </div>

        {/* Righe per anno */}
        <div className="space-y-1">
          {years.map((y) => {
            const rowTotal = Array.from({ length: 12 }, (_, i) => i + 1)
              .reduce((s, m) => s + getMetricValue(data[y][m], metric), 0);

            return (
              <div key={y} className="grid items-stretch"
                   style={{ gridTemplateColumns: '100px repeat(12, minmax(64px, 1fr)) 120px' }}>
                <div className="sticky left-0 bg-background z-10 text-sm font-medium">{y}</div>

                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                  const v = getMetricValue(data[y][m], metric);
                  const rel = buildHeat(v, maxValue);
                  const yoy = showYoY ? yoyChange(y, m) : null;
                  return (
                    <div key={`${y}-${m}`} className={`rounded px-2 py-2 text-center ${rel}`} title={formatEuro(v)}>
                      <div className={`text-xs ${v > maxValue * 0.6 ? 'text-white' : ''}`}>
                        {v > 999 ? `${Math.round(v/1000)}k` : Math.round(v)}
                      </div>
                      {yoy !== null && (
                        <div className={`text-[10px] font-medium flex items-center justify-center gap-0.5
                          ${yoy > 0 ? 'text-green-600' : yoy < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                          {yoy > 0 ? <ArrowUp className="h-3 w-3" /> : yoy < 0 ? <ArrowDown className="h-3 w-3" /> : null}
                          {Math.abs(yoy).toFixed(0)}%
                        </div>
                      )}
                    </div>
                  );
                })}

                <div className="text-right text-sm font-semibold">{formatEuro(rowTotal)}</div>
              </div>
            );
          })}
        </div>

        {/* Righe TOT/MEDIA */}
        <div className="grid items-center"
             style={{ gridTemplateColumns: '100px repeat(12, minmax(64px, 1fr)) 120px' }}>
          <div className="sticky left-0 bg-background z-10 text-sm font-semibold">TOT</div>
          {columnTotals.map((t, i) => (
            <div key={`tot-${i}`} className="text-center text-sm font-semibold">{formatEuro(t)}</div>
          ))}
          <div className="text-right text-sm font-semibold">{formatEuro(grandTotal)}</div>
        </div>

        <div className="grid items-center"
             style={{ gridTemplateColumns: '100px repeat(12, minmax(64px, 1fr)) 120px' }}>
          <div className="sticky left-0 bg-background z-10 text-sm font-semibold">MEDIA</div>
          {columnAverages.map((a, i) => (
            <div key={`avg-${i}`} className="text-center text-sm">{formatEuro(a)}</div>
          ))}
          <div className="text-right text-sm">{formatEuro(grandAverage)}</div>
        </div>

        {/* Legenda */}
        <div className="flex items-center gap-2 pt-2 text-xs text-muted-foreground">
          <span>Intensità colore proporzionale al valore</span>
          <span className="inline-block h-3 w-7 rounded bg-muted/20" />
          <span>Basso</span>
          <span className="inline-block h-3 w-7 rounded bg-primary" />
          <span>Alto</span>
        </div>
      </CardContent>
    </Card>
  );
}