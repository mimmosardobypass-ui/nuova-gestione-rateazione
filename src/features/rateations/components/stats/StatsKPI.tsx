import { CompactKpiCard } from "@/components/kpi/CompactKpiCards";
import { Euro, TrendingUp, AlertCircle, Leaf } from "lucide-react";
import type { StatsKPIs } from "../../types/stats";

interface StatsKPIProps {
  kpis: StatsKPIs;
  loading: boolean;
}

export function StatsKPI({ kpis, loading }: StatsKPIProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <CompactKpiCard
        title="Residuo Totale"
        value={kpis.residual_total}
        icon={<Euro className="h-4 w-4" />}
        loading={loading}
        highlight="primary"
      />
      <CompactKpiCard
        title="Pagato Totale"
        value={kpis.paid_total}
        icon={<TrendingUp className="h-4 w-4" />}
        loading={loading}
        highlight="primary"
      />
      <CompactKpiCard
        title="In Ritardo"
        value={kpis.overdue_total}
        icon={<AlertCircle className="h-4 w-4" />}
        loading={loading}
        highlight="destructive"
      />
      <CompactKpiCard
        title="Risparmio RQ"
        value={kpis.quater_saving}
        subtitle="Rottamazione Quater"
        icon={<Leaf className="h-4 w-4 text-emerald-600" />}
        loading={loading}
        highlight="primary"
        tooltip="Differenza tra debito originario e importo ridotto con Rottamazione Quater"
      />
    </div>
  );
}
