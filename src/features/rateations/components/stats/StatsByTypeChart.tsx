import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { StatsByType } from "../../types/stats";
import { formatCentsToEur } from "../../utils/statsFormatters";
import { formatEuroFromCents } from "@/lib/formatters";

interface StatsByTypeChartProps {
  data: StatsByType[];
}

export function StatsByTypeChart({ data }: StatsByTypeChartProps) {
  const chartData = data.map(item => ({
    type: item.type_label,
    totale: formatCentsToEur(item.total_amount_cents),
    pagato: formatCentsToEur(item.paid_amount_cents),
    residuo: formatCentsToEur(item.residual_amount_cents),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Importi per Tipologia</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="type" />
            <YAxis tickFormatter={(value) => formatEuroFromCents(value * 100)} />
            <Tooltip formatter={(value: number) => formatEuroFromCents(value * 100)} />
            <Legend />
            <Bar dataKey="totale" fill="#8884d8" name="Totale" />
            <Bar dataKey="pagato" fill="#2b8a3e" name="Pagato" />
            <Bar dataKey="residuo" fill="#e03131" name="Residuo" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
