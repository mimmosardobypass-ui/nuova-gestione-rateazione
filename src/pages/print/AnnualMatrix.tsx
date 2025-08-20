import React, { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowUp, ArrowDown } from "lucide-react";
import { useMonthlyMatrix } from "@/features/rateations/hooks/useMonthlyMatrix";
import type { MetricType } from "@/features/rateations/types/monthly-matrix";
import { formatEuro } from "@/lib/formatters";

const MONTH_NAMES = ["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"] as const;
const METRIC_LABELS: Record<MetricType, string> = {
  due: "Dovuto",
  paid: "Pagato",
  overdue: "In ritardo",
  extra_ravv: "Ravvedimento",
};

function getMetricValue(m: any, metric: MetricType): number {
  switch (metric) {
    case "due": return Number(m?.due_amount || 0);
    case "paid": return Number(m?.paid_amount || 0);
    case "overdue": return Number(m?.overdue_amount || 0);
    case "extra_ravv": return Number(m?.extra_ravv_amount || 0);
    default: return 0;
  }
}

function buildHeat(value: number, max: number): string {
  if (!max || !Number.isFinite(max)) return "bg-gray-50";
  const r = Math.max(0, Math.min(1, value / max));
  if (r === 0) return "bg-gray-50";
  if (r <= 0.2) return "bg-gray-100";
  if (r <= 0.4) return "bg-gray-200";
  if (r <= 0.6) return "bg-gray-300";
  if (r <= 0.8) return "bg-gray-400";
  return "bg-gray-500";
}

export default function AnnualMatrixPrint() {
  const [search] = useSearchParams();
  const { data, years, loading, error } = useMonthlyMatrix();

  const metric = (search.get("metric") as MetricType) || "paid";
  const showYoY = search.get("yoy") === "1";
  const theme = search.get("theme") === "bn" ? "theme-bn" : "";
  const density = search.get("density") === "compact" ? "density-compact" : "";
  const logoUrl = search.get("logo") || "";
  const bodyClass = `${theme} ${density}`.trim();

  // Auto-print robusto
  useEffect(() => {
    if (!loading && !error && years.length > 0) {
      (async () => {
        try { await (document as any).fonts?.ready; } catch {}
        setTimeout(() => { window.focus(); window.print(); }, 250);
      })();
    }
  }, [loading, error, years.length]);

  const maxValue = useMemo(() => {
    let max = 0;
    years.forEach(y => { for (let m = 1; m <= 12; m++) max = Math.max(max, getMetricValue(data[y]?.[m], metric)); });
    return max;
  }, [data, years, metric]);

  const yoyChange = (y: number, m: number): number | null => {
    const prev = y - 1;
    if (!data[prev]) return null;
    const cur = getMetricValue(data[y][m], metric);
    const prv = getMetricValue(data[prev][m], metric);
    if (prv === 0) return cur > 0 ? 100 : 0;
    return ((cur - prv) / prv) * 100;
  };

  const columnTotals = useMemo(
    () => Array.from({ length: 12 }, (_, i) => {
      const mm = i + 1;
      return years.reduce((s, y) => s + getMetricValue(data[y][mm], metric), 0);
    }),
    [years, data, metric]
  );
  const grandTotal = useMemo(() => columnTotals.reduce((s, v) => s + v, 0), [columnTotals]);
  const columnAverages = useMemo(() => columnTotals.map(t => (years.length ? t / years.length : 0)), [columnTotals, years]);
  const grandAverage = useMemo(() => (years.length ? grandTotal / years.length : 0), [grandTotal, years]);

  const rowTotals = useMemo(() => {
    const byYear: Record<number, number> = {};
    years.forEach(y => {
      let tot = 0;
      for (let m = 1; m <= 12; m++) tot += getMetricValue(data[y][m], metric);
      byYear[y] = tot;
    });
    return byYear;
  }, [data, years, metric]);

  if (loading) return <div>Caricamento matrice...</div>;
  if (error) return <div>Errore: {String(error)}</div>;
  if (years.length === 0) return <div>Nessun dato disponibile per la matrice annuale.</div>;

  return (
    <div className={bodyClass}>
      <div className="p-6 print:p-0">
        {/* Header stampa */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-lg font-semibold">Matrice annuale – {METRIC_LABELS[metric]}</div>
            <div className="text-xs text-muted-foreground">Generato: {new Date().toLocaleString("it-IT")}</div>
          </div>
          {logoUrl ? <img src={logoUrl} alt="Logo" className="h-10 object-contain" /> : null}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-14 gap-px text-xs">
          {/* header */}
          <div className="sticky left-0 bg-background z-10 px-2 py-1 font-medium">Anno</div>
          {MONTH_NAMES.map((mn) => (
            <div key={mn} className="px-2 py-1 font-medium text-center">{mn}</div>
          ))}
          <div className="px-2 py-1 font-medium text-right">Totale</div>

          {/* righe dati */}
          {years.map((y) => (
            <React.Fragment key={y}>
              <div className="sticky left-0 bg-background z-10 px-2 py-1">{y}</div>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                const v = getMetricValue(data[y][m], metric);
                const rel = buildHeat(v, maxValue);
                const yoy = showYoY ? yoyChange(y, m) : null;
                return (
                  <div key={`${y}-${m}`} className={`px-2 py-1 text-center ${rel}`} title={formatEuro(v)}>
                    <div className={`${v >= maxValue * 0.6 ? "text-white" : ""}`}>
                      {formatEuro(v)}
                    </div>
                    {yoy !== null && (
                      <div className={`text-[10px] ${yoy > 0 ? "text-green-700" : yoy < 0 ? "text-red-700" : "text-gray-600"}`}>
                        {yoy > 0 ? <ArrowUp className="inline h-3 w-3" /> : yoy < 0 ? <ArrowDown className="inline h-3 w-3" /> : null}
                        {Math.abs(yoy).toFixed(0)}%
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="px-2 py-1 text-right font-medium">{formatEuro(rowTotals[y])}</div>
            </React.Fragment>
          ))}

          {/* totali */}
          <div className="sticky left-0 bg-background z-10 px-2 py-1 font-medium">TOTALE</div>
          {columnTotals.map((t, i) => (
            <div key={`tot-${i}`} className="px-2 py-1 text-right font-medium">{formatEuro(t)}</div>
          ))}
          <div className="px-2 py-1 text-right font-semibold">{formatEuro(grandTotal)}</div>

          {/* medie */}
          <div className="sticky left-0 bg-background z-10 px-2 py-1 font-medium">MEDIA</div>
          {columnAverages.map((a, i) => (
            <div key={`avg-${i}`} className="px-2 py-1 text-right font-medium">{formatEuro(a)}</div>
          ))}
          <div className="px-2 py-1 text-right font-semibold">{formatEuro(grandAverage)}</div>
        </div>

        {/* legenda */}
        <div className="mt-3 text-xs text-muted-foreground">
          Intensità colore proporzionale al valore:
          <span className="inline-block w-3 h-3 bg-gray-100 mx-1 align-middle" /> basso
          <span className="inline-block w-3 h-3 bg-gray-500 mx-1 align-middle" /> alto
        </div>
      </div>

      <style>{`
        .grid-cols-14 {
          grid-template-columns: minmax(60px, 1fr) repeat(12, minmax(56px, 1fr)) minmax(90px, 1fr);
        }
      `}</style>
    </div>
  );
}