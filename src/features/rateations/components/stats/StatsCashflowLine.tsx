import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { StatsCashflowMonthly } from "../../types/stats";
import { formatCentsToEur, formatMonth } from "../../utils/statsFormatters";
import { CASHFLOW_COLORS } from "../../utils/statsColors";
import { formatEuroFromCents } from "@/lib/formatters";

interface StatsCashflowLineProps {
  data: StatsCashflowMonthly[];
}

export function StatsCashflowLine({ data }: StatsCashflowLineProps) {
  const sortedData = [...data].sort((a, b) => a.month.localeCompare(b.month));
  const chartData = sortedData.map(item => ({
    month: formatMonth(item.month),
    pagato: formatCentsToEur(item.paid_amount_cents),
    dovuto: formatCentsToEur(item.due_amount_cents),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cash Flow Mensile</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis tickFormatter={(value) => formatEuroFromCents(value * 100)} />
            <Tooltip formatter={(value: number) => formatEuroFromCents(value * 100)} />
            <Legend />
            <Line type="monotone" dataKey="pagato" stroke={CASHFLOW_COLORS.paid} name="Pagato" />
            <Line type="monotone" dataKey="dovuto" stroke={CASHFLOW_COLORS.due} name="Dovuto" />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
