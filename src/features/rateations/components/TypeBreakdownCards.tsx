import type { KpiBreakdown } from "../api/kpi";
import { F24Card, PagopaCard, RottamazioniCard } from "./type-cards";

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
    <section className="grid gap-3 grid-cols-1 md:grid-cols-3">
      <F24Card 
        breakdown={{ due: breakdown.due, paid: breakdown.paid, residual: breakdown.residual }} 
        loading={loading} 
      />
      <PagopaCard 
        breakdown={{ due: breakdown.due, paid: breakdown.paid, residual: breakdown.residual }} 
        loading={loading} 
      />
      <RottamazioniCard 
        breakdown={{ due: breakdown.due, paid: breakdown.paid, residual: breakdown.residual }} 
        savingRQ={savingRQ}
        savingR5={savingR5}
        loading={loading} 
      />
    </section>
  );
}
