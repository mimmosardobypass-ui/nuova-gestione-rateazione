import { CompactKpiCard } from "@/components/kpi/CompactKpiCards";
import { Euro, TrendingUp, AlertCircle, Leaf } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { StatsKPIs } from "../../types/stats";

interface StatsKPIProps {
  kpis: StatsKPIs;
  loading: boolean;
}

export function StatsKPI({ kpis, loading }: StatsKPIProps) {
  return (
    <TooltipProvider>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <CompactKpiCard
                title="Residuo Totale"
                value={kpis.residual_total}
                icon={<Euro className="h-4 w-4" />}
                loading={loading}
                highlight="primary"
              />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Somma degli importi residui di tutte le rateazioni filtrate</p>
          </TooltipContent>
        </Tooltip>

        <CompactKpiCard
          title="Pagato Totale"
          value={kpis.paid_total}
          icon={<TrendingUp className="h-4 w-4" />}
          loading={loading}
          highlight="primary"
        />

        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <CompactKpiCard
                title="In Ritardo"
                value={kpis.overdue_total}
                icon={<AlertCircle className="h-4 w-4" />}
                loading={loading}
                highlight="destructive"
              />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Importo delle rate scadute e non pagate</p>
          </TooltipContent>
        </Tooltip>

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
    </TooltipProvider>
  );
}
