import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useResidualAndDecadenceKpis } from "@/features/rateations/hooks/useResidualAndDecadenceKpis";
import { ResidualDecadenceRow } from "@/components/kpi/CompactKpiCards";

export default function ResidualDecadenceSection() {
  const nav = useNavigate();
  const {
    loading,
    residualEuro,
    decNetEuro,
    totalEuro,
    overdueEffectiveEuro,
  } = useResidualAndDecadenceKpis();

  return (
    <div className="mt-8">
      <ResidualDecadenceRow
        residualEuro={residualEuro}
        decNetEuro={decNetEuro}
        totalEuro={totalEuro}
        overdueEffectiveEuro={overdueEffectiveEuro}
        loading={loading}
        onOpenDecadenze={() => nav("/rateazioni?view=decadenze")}
        onOpenRisparmi={() => nav("/risparmi-rq")}
      />
    </div>
  );
}
