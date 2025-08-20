import React, { useEffect, useState, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useMonthlyMatrix } from "@/features/rateations/hooks/useMonthlyMatrix";
import type { MetricType } from "@/features/rateations/types/monthly-matrix";
import { formatEuro } from "@/lib/formatters";
import PrintLayout from "@/components/print/PrintLayout";
import { ArrowDown, ArrowUp } from "lucide-react";

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
  if (!max || !Number.isFinite(max)) return 'bg-gray-50';
  const r = Math.max(0, Math.min(1, value / max));
  if (r === 0) return 'bg-gray-50';
  if (r <= 0.2) return 'bg-gray-100';
  if (r <= 0.4) return 'bg-gray-200';
  if (r <= 0.6) return 'bg-gray-300';
  if (r <= 0.8) return 'bg-gray-400';
  return 'bg-gray-500';
}

export default function AnnualMatrix() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { data, years, loading, error } = useMonthlyMatrix();

  const metric = (searchParams.get("metric") as MetricType) || 'paid';
  const showYoY = searchParams.get("yoy") === '1';
  const theme = searchParams.get("theme") === "bn" ? "theme-bn" : "";
  const density = searchParams.get("density") === "compact" ? "density-compact" : "";
  const bodyClass = `${theme} ${density}`.trim();
  const logoUrl = searchParams.get("logo") || undefined;

  // Auto-print dopo caricamento
  useEffect(() => {
    if (!loading && !error && years.length > 0) {
      const go = async () => {
        try { await (document as any).fonts?.ready; } catch {}
        setTimeout(() => {
          window.focus();
          window.print();
        }, 250);
      };
      go();
    }
  }, [loading, error, years.length]);

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

  const rowTotals = useMemo(() => {
    const byYear: Record<number, number> = {};
    years.forEach(y => {
      let tot = 0;
      for (let m = 1; m <= 12; m++) tot += getMetricValue(data[y][m], metric);
      byYear[y] = tot;
    });
    return byYear;
  }, [data, years, metric]);

  if (loading) {
    return <div>Caricamento matrice...</div>;
  }

  if (error) {
    return <div>Errore: {error}</div>;
  }

  if (years.length === 0) {
    return <div>Nessun dato disponibile per la matrice annuale.</div>;
  }

  return (
    <PrintLayout 
      title={`Matrice Annuale - ${METRIC_LABELS[metric]}`}
      subtitle={showYoY ? "Con confronto anno su anno (YoY)" : "Valori assoluti"}
      logoUrl={logoUrl}
      bodyClass={bodyClass}
    >
      {/* Header */}
      <div className="grid grid-cols-14 gap-1 mb-2 text-xs font-semibold border-b pb-2">
        <div>Anno</div>
        {MONTH_NAMES.map((mn) => (
          <div key={mn} className="text-center">{mn}</div>
        ))}
        <div className="text-right">Totale</div>
      </div>

      {/* Data rows */}
      <div className="space-y-1">
        {years.map((y) => (
          <div key={y} className="grid grid-cols-14 gap-1 items-center text-xs">
            <div className="font-medium">{y}</div>
            
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
              const v = getMetricValue(data[y][m], metric);
              const rel = buildHeat(v, maxValue);
              const yoy = showYoY ? yoyChange(y, m) : null;
              
              return (
                <div key={`${y}-${m}`} className={`rounded px-1 py-1 text-center ${rel}`}>
                  <div className="text-xs">
                    {v > 999 ? `${Math.round(v/1000)}k` : Math.round(v)}
                  </div>
                  {yoy !== null && (
                    <div className={`text-[9px] font-medium flex items-center justify-center gap-0.5
                      ${yoy > 0 ? 'text-green-700' : yoy < 0 ? 'text-red-700' : 'text-gray-600'}`}>
                      {yoy > 0 ? <ArrowUp className="h-2 w-2" /> : yoy < 0 ? <ArrowDown className="h-2 w-2" /> : null}
                      {Math.abs(yoy).toFixed(0)}%
                    </div>
                  )}
                </div>
              );
            })}

            <div className="text-right font-semibold">{formatEuro(rowTotals[y])}</div>
          </div>
        ))}
      </div>

      {/* Totals row */}
      <div className="grid grid-cols-14 gap-1 items-center text-xs font-semibold border-t pt-2 mt-4">
        <div>TOTALE</div>
        {columnTotals.map((t, i) => (
          <div key={`tot-${i}`} className="text-center">{formatEuro(t)}</div>
        ))}
        <div className="text-right">{formatEuro(grandTotal)}</div>
      </div>

      {/* Averages row */}
      <div className="grid grid-cols-14 gap-1 items-center text-xs mt-1">
        <div className="font-semibold">MEDIA</div>
        {columnAverages.map((a, i) => (
          <div key={`avg-${i}`} className="text-center">{formatEuro(a)}</div>
        ))}
        <div className="text-right">{formatEuro(grandAverage)}</div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 pt-4 text-xs text-gray-600 border-t mt-4">
        <span>Intensità colore proporzionale al valore:</span>
        <span className="inline-block h-3 w-6 rounded bg-gray-50 border" />
        <span>Basso</span>
        <span className="inline-block h-3 w-6 rounded bg-gray-500" />
        <span>Alto</span>
      </div>

      <style>{`
        .grid-cols-14 {
          grid-template-columns: minmax(60px, 1fr) repeat(12, minmax(40px, 1fr)) minmax(80px, 1fr);
        }
      `}</style>
    </PrintLayout>
  );
}