import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { StatsByStatus } from "../../types/stats";
import { formatCentsToEur } from "../../utils/statsFormatters";
import { getStatusColor } from "../../utils/statsColors";
import { formatEuroFromCents } from "@/lib/formatters";

interface StatsByStatusPieProps {
  data: StatsByStatus[];
}

export function StatsByStatusPie({ data }: StatsByStatusPieProps) {
  const chartData = data.map(item => ({
    name: item.status,
    value: formatCentsToEur(item.total_amount_cents),
    color: getStatusColor(item.status),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Distribuzione per Stato</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={80}
              label
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip formatter={(value: number) => formatEuroFromCents(value * 100)} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
