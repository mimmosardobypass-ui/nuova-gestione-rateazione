import { Card, CardContent } from "@/components/ui/card";
import { formatEuroFromCents, formatPercentage } from "../../utils/statsV3Formatters";
import type { StatsV3KPIs as KPIsType } from "../../hooks/useStatsV3";

interface StatsV3KPIsProps {
  kpis: KPIsType;
  totalPaidOverride?: number; // Cents - valore dalla monthlyMatrix
}

export function StatsV3KPIs({ kpis, totalPaidOverride }: StatsV3KPIsProps) {
  const cards = [
    { 
      label: "Totale Dovuto", 
      value: kpis.total_due_cents, 
      icon: "💰", 
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200",
      textColor: "text-blue-900"
    },
    { 
      label: "Totale Pagato", 
      value: totalPaidOverride ?? kpis.total_paid_cents, 
      icon: "💵", 
      bgColor: "bg-green-50",
      borderColor: "border-green-200",
      textColor: "text-green-900"
    },
    { 
      label: "Totale Residuo", 
      value: kpis.total_residual_cents, 
      icon: "📊", 
      bgColor: "bg-amber-50",
      borderColor: "border-amber-200",
      textColor: "text-amber-900"
    },
    { 
      label: "In Ritardo", 
      value: kpis.total_overdue_cents, 
      icon: "⚠️", 
      bgColor: "bg-orange-50",
      borderColor: "border-orange-200",
      textColor: "text-orange-900"
    },
    { 
      label: "Decaduto", 
      value: kpis.total_decayed_cents, 
      icon: "❌", 
      bgColor: "bg-red-50",
      borderColor: "border-red-200",
      textColor: "text-red-900"
    },
    { 
      label: "Risparmio RQ", 
      value: kpis.rq_saving_cents, 
      icon: "💚", 
      bgColor: "bg-emerald-50",
      borderColor: "border-emerald-200",
      textColor: "text-emerald-900"
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-4 mb-6">
      {cards.map((card) => (
        <Card key={card.label} className={`${card.bgColor} ${card.borderColor} border-2 shadow-sm hover:shadow-md transition-shadow`}>
          <CardContent className="p-4">
            <div className="text-3xl mb-2">{card.icon}</div>
            <div className="text-sm text-muted-foreground mb-1 font-medium">{card.label}</div>
            <div className={`text-xl font-bold ${card.textColor}`}>
              {formatEuroFromCents(card.value)}
            </div>
          </CardContent>
        </Card>
      ))}
      <Card className="bg-purple-50 border-purple-200 border-2 shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="text-3xl mb-2">✅</div>
          <div className="text-sm text-muted-foreground mb-1 font-medium">Completamento</div>
          <div className="text-xl font-bold text-purple-900">
            {formatPercentage(kpis.completion_percent)}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
