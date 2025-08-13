import React from "react";
import { formatEuro } from "@/lib/formatters";

function Kpi({ label, value, loading }: { label: string; value: number; loading: boolean }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-2 text-xl font-semibold">
        {loading ? "—" : formatEuro(value)}
      </div>
    </div>
  );
}

export function KpiCards({
  loading,
  stats,
  previousStats,
}: {
  loading: boolean;
  stats: { total_due: number; total_paid: number; total_residual: number; total_late: number };
  previousStats?: { total_due: number; total_paid: number; total_residual: number; total_late: number } | null;
}) {
  const display = loading && previousStats ? previousStats : stats;
  const showLoading = loading && !previousStats;
  
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Kpi label="Totale dovuto"  value={display.total_due}      loading={showLoading} />
      <Kpi label="Totale pagato"  value={display.total_paid}      loading={showLoading} />
      <Kpi label="Totale residuo" value={display.total_residual} loading={showLoading} />
      <Kpi label="In ritardo"     value={display.total_late}      loading={showLoading} />
    </section>
  );
}