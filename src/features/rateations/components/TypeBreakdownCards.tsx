import type { KpiBreakdown } from "../api/kpi";
import { F24Card, PagopaCard, QuaterCard, RiamQuaterCard, QuinquiesCard } from "./type-cards";

interface TypeBreakdownCardsProps {
  loading: boolean;
  breakdown: {
    due: KpiBreakdown;
    paid: KpiBreakdown;
    residual: KpiBreakdown;
    overdue: KpiBreakdown;
  };
  savingRQ: number;
  savingR5: number;
}

export function TypeBreakdownCards({ 
  loading, 
  breakdown, 
  savingRQ, 
  savingR5 
}: TypeBreakdownCardsProps) {
  return (
    <section className="grid gap-3 grid-cols-2 lg:grid-cols-5">
      <F24Card 
        breakdown={{ due: breakdown.due, paid: breakdown.paid, residual: breakdown.residual }} 
        loading={loading} 
      />
      <PagopaCard 
        breakdown={{ due: breakdown.due, residual: breakdown.residual }} 
        loading={loading} 
      />
      <QuaterCard 
        breakdown={{ due: breakdown.due, paid: breakdown.paid, residual: breakdown.residual }} 
        saving={savingRQ}
        loading={loading} 
      />
      <RiamQuaterCard 
        breakdown={{ due: breakdown.due, paid: breakdown.paid, residual: breakdown.residual }} 
        loading={loading} 
      />
      <QuinquiesCard 
        breakdown={{ due: breakdown.due, paid: breakdown.paid, residual: breakdown.residual }} 
        saving={savingR5}
        loading={loading} 
      />
    </section>
  );
}
