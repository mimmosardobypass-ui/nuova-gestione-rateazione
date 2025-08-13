import React from "react";

const euro = (n: number) =>
  n.toLocaleString("it-IT", { style: "currency", currency: "EUR" });

function Kpi({ label, value, loading }: { label: string; value: number; loading: boolean }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-2 text-xl font-semibold">
        {loading ? "—" : euro(value)}
      </div>
    </div>
  );
}

export function KpiCards({
  loading,
  stats,
}: {
  loading: boolean;
  stats: { total_due: number; total_paid: number; total_residual: number; total_late: number };
}) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Kpi label="Totale dovuto"  value={stats.total_due}      loading={loading} />
      <Kpi label="Totale pagato"  value={stats.total_paid}      loading={loading} />
      <Kpi label="Totale residuo" value={stats.total_residual} loading={loading} />
      <Kpi label="In ritardo"     value={stats.total_late}      loading={loading} />
    </section>
  );
}