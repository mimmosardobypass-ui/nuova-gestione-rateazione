import React from "react";
import { LineChart, Line, ResponsiveContainer, Tooltip } from "recharts";
import { formatEuro } from "@/lib/formatters";
import { Skeleton } from "./skeleton";

interface SparklineData {
  month: string;
  paid: number;
  due: number;
}

interface SparklineProps {
  data: SparklineData[];
  loading?: boolean;
  className?: string;
}

function SparklineTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border bg-background p-2 shadow-md">
        <p className="text-xs font-medium">{label}</p>
        {payload.map((entry: any) => (
          <p key={entry.dataKey} className="text-xs" style={{ color: entry.color }}>
            {entry.dataKey === 'paid' ? 'Pagato' : 'Dovuto'}: {formatEuro(entry.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
}

export function Sparkline({ data, loading = false, className = "" }: SparklineProps) {
  if (loading) {
    return <Skeleton className={`h-10 w-full ${className}`} />;
  }

  if (!data || data.length === 0) {
    return null;
  }

  return (
    <div className={`h-10 w-full ${className}`} aria-label="Andamento ultimi 12 mesi Pagato/Dovuto">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <Line
            type="monotone"
            dataKey="paid"
            stroke="hsl(var(--primary))"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 2, stroke: "hsl(var(--primary))", strokeWidth: 1 }}
          />
          <Line
            type="monotone"
            dataKey="due"
            stroke="hsl(var(--muted-foreground))"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 2, stroke: "hsl(var(--muted-foreground))", strokeWidth: 1 }}
          />
          <Tooltip content={<SparklineTooltip />} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}