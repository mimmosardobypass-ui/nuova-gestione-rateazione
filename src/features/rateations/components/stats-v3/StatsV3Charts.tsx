import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { StatsV3ByType } from "../../hooks/useStatsV3";
import type { MonthlyMatrix } from "../../hooks/useMonthlyEvolution";
import { formatCentsToEur, formatTypeLabel } from "../../utils/statsV3Formatters";

interface StatsV3ChartsProps {
  byType: StatsV3ByType[];
  monthlyMatrix: MonthlyMatrix | null;
}

const TYPE_COLORS: Record<string, string> = {
  F24: "#e03131",
  PAGOPA: "#2f6ee5",
  ROTTAMAZIONE_QUATER: "#2b8a3e",
  RIAMMISSIONE_QUATER: "#0ca678",
  ALTRO: "#868e96",
};

const MONTHS_LABELS = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

export function StatsV3Charts({ byType, monthlyMatrix }: StatsV3ChartsProps) {
  // Prepare data for line chart from monthlyMatrix (same data as table)
  const lineChartData = useMemo(() => {
    if (!monthlyMatrix || !monthlyMatrix.years.length) {
      return MONTHS_LABELS.map(month => ({ month, Totale: 0, Pagato: 0, Residuo: 0 }));
    }
    
    return MONTHS_LABELS.map((monthLabel, i) => {
      const m = i + 1;
      let totale = 0, pagato = 0, residuo = 0;
      
      monthlyMatrix.years.forEach(y => {
        const cell = monthlyMatrix.cells.get(`${y}-${m}`);
        if (cell) {
          totale += cell.total_cents;
          pagato += cell.paid_cents;
          residuo += cell.unpaid_cents;
        }
      });
      
      return {
        month: monthLabel,
        Totale: formatCentsToEur(totale),
        Pagato: formatCentsToEur(pagato),
        Residuo: formatCentsToEur(residuo),
      };
    });
  }, [monthlyMatrix]);

  // Prepare data for pie chart
  const pieChartData = byType.map((t) => ({
    name: formatTypeLabel(t.type),
    value: formatCentsToEur(t.total_cents),
    rawType: t.type,
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      {/* Line Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">📈 Andamento Mensile</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={lineChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value) => `€${Number(value).toLocaleString("it-IT", { minimumFractionDigits: 2 })}`} />
              <Legend />
              <Line type="monotone" dataKey="Totale" stroke="#2f6ee5" strokeWidth={2} />
              <Line type="monotone" dataKey="Pagato" stroke="#2b8a3e" strokeWidth={2} />
              <Line type="monotone" dataKey="Residuo" stroke="#f08c00" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Pie Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">🥧 Distribuzione per Tipologia</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieChartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => `${entry.name}: €${entry.value.toLocaleString("it-IT")}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {pieChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={TYPE_COLORS[entry.rawType] || "#868e96"} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `€${Number(value).toLocaleString("it-IT", { minimumFractionDigits: 2 })}`} />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
