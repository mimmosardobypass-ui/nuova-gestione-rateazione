import React, { useMemo, useState } from "react";
import { ArrowLeft, ArrowDown, ArrowUp, Download, Printer } from "lucide-react";
import { useMonthlyMatrix } from "@/features/rateations/hooks/useMonthlyMatrix";
import type { MetricType } from "@/features/rateations/types/monthly-matrix";
import { formatEuro } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PrintService } from "@/utils/printUtils";

const MONTH_NAMES = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'] as const;

const METRIC_LABELS: Record<MetricType, string> = {
  due: 'Dovuto',
  paid: 'Pagato',
  overdue: 'In ritardo',
  extra_ravv: 'Ravvedimento',
};

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
  const r = Math.max(0, Math.min(1, value / max));
  if (r === 0) return 'bg-muted/20';
  if (r <= 0.2) return 'bg-primary/20';
  if (r <= 0.4) return 'bg-primary/40';
  if (r <= 0.6) return 'bg-primary/60';
  if (r <= 0.8) return 'bg-primary/80';
  return 'bg-primary';
}

type Props = { onBack?: () => void };

export default function AnnualMatrixCard({ onBack }: Props) {
  const { data, years, loading, error } = useMonthlyMatrix();
  const [metric, setMetric] = useState<MetricType>('paid'); // default più "parlante"
  const [showYoY, setShowYoY] = useState<boolean>(false);

  // ---- calcoli PRIMA di funzioni che li usano (evita TDZ) ----
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
    [columnTotals, years]
  );

  const grandAverage = useMemo(
    () => (years.length ? grandTotal / years.length : 0),
    [grandTotal, years]
  );

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

    // TOTALE, MEDIA dalle memo (niente parsing stringhe)
    rows.push(['TOTALE', ...columnTotals.map(v => v.toLocaleString('it-IT', { minimumFractionDigits: 2 })), grandTotal.toLocaleString('it-IT', { minimumFractionDigits: 2 })].join(';'));
    rows.push(['MEDIA', ...columnAverages.map(v => v.toLocaleString('it-IT', { minimumFractionDigits: 2 })), grandAverage.toLocaleString('it-IT', { minimumFractionDigits: 2 })].join(';'));

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
        <CardContent>Errore: {String(error)}</CardContent>
      </Card>
    );
  }
  if (years.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle>Comparazione annuale</CardTitle></CardHeader>
        <CardContent>Nessun dato disponibile.</CardContent>
      </Card>
    );
  }

  // totali per riga (per UI)
  const rowTotal = (y: number) => Array.from({ length: 12 }, (_, i) => i + 1)
    .reduce((s, m) => s + getMetricValue(data[y][m], metric), 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {onBack && (
            <Button variant="outline" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
          )}
          <CardTitle>Matrice annuale – {METRIC_LABELS[metric]}</CardTitle>
        </div>
        <div className="flex items-center gap-2">
          <Button variant={showYoY ? "default" : "outline"} size="sm" onClick={() => setShowYoY(v => !v)}>YoY</Button>
          <Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-4 w-4 mr-1" />CSV</Button>
          <Button
            size="sm"
            onClick={() => PrintService.openAnnualMatrixPreview({ metric, yoy: showYoY })}
          >
            <Printer className="h-4 w-4 mr-1" />
            Stampa
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Metric selector */}
        <div className="flex flex-wrap gap-2">
          {(['paid','due','overdue','extra_ravv'] as MetricType[]).map(m => (
            <Button key={m} size="sm" variant={metric === m ? "default" : "outline"} onClick={() => setMetric(m)}>
              {METRIC_LABELS[m]}
            </Button>
          ))}
        </div>

        {/* Header mesi */}
        <div className="grid grid-cols-14 gap-px text-xs">
          <div className="sticky left-0 bg-background z-10 px-2 py-1 font-medium">Anno</div>
          {MONTH_NAMES.map(mn => (
            <div key={mn} className="px-2 py-1 font-medium text-center">{mn}</div>
          ))}
          <div className="px-2 py-1 font-medium text-right">Totale</div>

          {/* Righe per anno */}
          {years.map((y) => (
            <React.Fragment key={y}>
              <div className="sticky left-0 bg-background z-10 px-2 py-1">{y}</div>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                const v = getMetricValue(data[y][m], metric);
                const rel = buildHeat(v, maxValue);
                const yoy = showYoY ? ((): number | null => {
                  const prev = y - 1;
                  if (!data[prev]) return null;
                  const cur = getMetricValue(data[y][m], metric);
                  const prv = getMetricValue(data[prev][m], metric);
                  if (prv === 0) return cur > 0 ? 100 : 0;
                  return ((cur - prv) / prv) * 100;
                })() : null;

                return (
                  <div key={`${y}-${m}`} className={`px-2 py-1 text-center ${rel}`} title={formatEuro(v)}>
                    <div className={`leading-tight whitespace-nowrap ${v >= maxValue * 0.6 ? "text-white" : ""}`}>
                      {formatEuro(v)}
                    </div>
                    {yoy !== null && (
                      <div className={`text-[10px] ${yoy > 0 ? "text-green-600" : yoy < 0 ? "text-red-600" : "text-muted-foreground"}`}>
                        {yoy > 0 ? <ArrowUp className="inline h-3 w-3" /> : yoy < 0 ? <ArrowDown className="inline h-3 w-3" /> : null}
                        {Math.abs(yoy).toFixed(0)}%
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="px-2 py-1 text-right font-medium">{formatEuro(rowTotal(y))}</div>
            </React.Fragment>
          ))}

          {/* TOT */}
          <div className="sticky left-0 bg-background z-10 px-2 py-1 font-medium">TOT</div>
          {columnTotals.map((t, i) => (
            <div key={`tot-${i}`} className="px-2 py-1 text-right font-medium">{formatEuro(t)}</div>
          ))}
          <div className="px-2 py-1 text-right font-semibold">{formatEuro(grandTotal)}</div>

          {/* MEDIA */}
          <div className="sticky left-0 bg-background z-10 px-2 py-1 font-medium">MEDIA</div>
          {columnAverages.map((a, i) => (
            <div key={`avg-${i}`} className="px-2 py-1 text-right font-medium">{formatEuro(a)}</div>
          ))}
          <div className="px-2 py-1 text-right font-semibold">{formatEuro(grandAverage)}</div>
        </div>

        <style>{`
          .grid-cols-14 {
            grid-template-columns: minmax(60px, 1fr) repeat(12, minmax(56px, 1fr)) minmax(90px, 1fr);
          }
        `}</style>
      </CardContent>
    </Card>
  );
}