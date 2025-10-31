import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useMonthlyEvolution } from "../../hooks/useMonthlyEvolution";
import { formatEuroFromCents } from "@/lib/formatters";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface MonthlyEvolutionChartProps {
  yearFrom: number;
  yearTo: number;
}

const MONTHS = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

export function MonthlyEvolutionChart({ yearFrom, yearTo }: MonthlyEvolutionChartProps) {
  const { loading, error, matrix } = useMonthlyEvolution({ yearFrom, yearTo });

  const chartData = useMemo(() => {
    if (!matrix) return [];

    return Array.from(matrix.cells.entries())
      .map(([key, cell]) => {
        const [year, month] = key.split("-").map(Number);
        const totalEur = cell.total_cents / 100;
        const paidEur = cell.paid_cents / 100;
        const unpaidEur = cell.unpaid_cents / 100;
        const percentPaid = totalEur > 0 ? ((paidEur / totalEur) * 100).toFixed(1) : "0.0";

        return {
          year,
          month,
          date: `${MONTHS[month - 1]} ${year}`,
          sortKey: year * 100 + month,
          totale: totalEur,
          pagato: paidEur,
          residuo: unpaidEur,
          percentPaid,
        };
      })
      .sort((a, b) => a.sortKey - b.sortKey);
  }, [matrix]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Errore nel caricamento dei dati: {error}</AlertDescription>
      </Alert>
    );
  }

  if (chartData.length === 0) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Nessun dato disponibile per il periodo selezionato.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Andamento Mensile Dettagliato</h3>
          <p className="text-sm text-muted-foreground">
            Evoluzione temporale di totale, pagato e residuo ({yearFrom} - {yearTo})
          </p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={600}>
        <LineChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
          <XAxis
            dataKey="date"
            angle={-45}
            textAnchor="end"
            height={80}
            tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }}
            stroke="hsl(var(--border))"
          />
          <YAxis
            tickFormatter={(value) => formatEuroFromCents(value * 100)}
            tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }}
            stroke="hsl(var(--border))"
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--background))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              padding: "12px",
            }}
            labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600, marginBottom: "8px" }}
            formatter={(value: number, name: string, props: any) => {
              const formatted = formatEuroFromCents(value * 100);
              if (name === "totale") {
                const percent = props.payload.percentPaid;
                return [
                  <span key="value">
                    {formatted} <span className="text-muted-foreground text-xs">({percent}% pagato)</span>
                  </span>,
                  "Totale",
                ];
              }
              return [formatted, name === "pagato" ? "Pagato" : "Residuo"];
            }}
          />
          <Legend
            wrapperStyle={{
              paddingTop: "20px",
            }}
            iconType="line"
            formatter={(value) => {
              const labels: Record<string, string> = {
                totale: "Totale",
                pagato: "Pagato",
                residuo: "Residuo",
              };
              return labels[value] || value;
            }}
          />
          <Line
            type="monotone"
            dataKey="totale"
            stroke="hsl(217, 91%, 60%)"
            strokeWidth={3}
            dot={{ r: 4, fill: "hsl(217, 91%, 60%)", strokeWidth: 0 }}
            activeDot={{ r: 6 }}
            name="totale"
          />
          <Line
            type="monotone"
            dataKey="pagato"
            stroke="hsl(142, 71%, 45%)"
            strokeWidth={3}
            dot={{ r: 4, fill: "hsl(142, 71%, 45%)", strokeWidth: 0 }}
            activeDot={{ r: 6 }}
            name="pagato"
          />
          <Line
            type="monotone"
            dataKey="residuo"
            stroke="hsl(25, 95%, 53%)"
            strokeWidth={3}
            dot={{ r: 4, fill: "hsl(25, 95%, 53%)", strokeWidth: 0 }}
            activeDot={{ r: 6 }}
            name="residuo"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
