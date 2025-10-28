import { useState } from "react";
import { Download, FileSpreadsheet, Printer, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useMonthlyMatrixByType } from "@/features/rateations/hooks/useMonthlyMatrixByType";
import { formatEuroFromCents } from "@/lib/formatters";
import type { PayFilterType } from "@/features/rateations/types/matrix-by-type";
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from "recharts";
import { exportMatrixToExcel, printMatrix } from "@/features/rateations/utils/scadenzeMatrixExport";

const MONTHS = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

const TYPE_COLORS: Record<string, string> = {
  F24: "#ef4444",
  PAGOPA: "#3b82f6",
  ROTTAMAZIONE_QUATER: "#10b981",
  RIAMMISSIONE_QUATER: "#06b6d4",
};

const TYPE_LABELS: Record<string, string> = {
  F24: "F24",
  PAGOPA: "PagoPA",
  ROTTAMAZIONE_QUATER: "Rottamazione Quater",
  RIAMMISSIONE_QUATER: "Riammissione Quater",
};

export default function ScadenzeMatrix() {
  const currentYear = new Date().getFullYear();
  
  const [payFilter, setPayFilter] = useState<PayFilterType>('unpaid');
  const [typeFilter, setTypeFilter] = useState<string[]>(['F24', 'PAGOPA', 'ROTTAMAZIONE_QUATER', 'RIAMMISSIONE_QUATER']);
  const [yearFilter, setYearFilter] = useState<number | null>(currentYear);

  const { data, years, loading, error } = useMonthlyMatrixByType({
    payFilter,
    typeFilter,
    yearFilter,
  });

  const handleTypeToggle = (type: string) => {
    setTypeFilter(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const handleYearChange = (value: string) => {
    setYearFilter(value === 'all' ? null : parseInt(value));
  };

  // Calculate KPIs
  const kpis = calculateKPIs(data, yearFilter || currentYear);

  // Prepare chart data
  const chartData = prepareChartData(data, yearFilter || currentYear);

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Errore</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Statistica Scadenze</h1>
          <p className="text-muted-foreground">Analisi mensile del debito residuo per tipologia</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => exportMatrixToExcel(data, { payFilter, typeFilter, yearFilter })}
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Excel
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => printMatrix()}
          >
            <Printer className="h-4 w-4 mr-2" />
            Stampa
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtri</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Year Filter */}
          <div className="space-y-2">
            <Label>Periodo</Label>
            <ToggleGroup 
              type="single" 
              value={yearFilter === null ? 'all' : yearFilter.toString()}
              onValueChange={handleYearChange}
            >
              <ToggleGroupItem value="all">
                <Calendar className="h-4 w-4 mr-2" />
                Tutti
              </ToggleGroupItem>
              {years.map(year => (
                <ToggleGroupItem key={year} value={year.toString()}>
                  {year}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          {/* Type Filter */}
          <div className="space-y-3">
            <Label>Tipologia</Label>
            <div className="flex flex-wrap gap-4">
              {Object.keys(TYPE_LABELS).map(type => (
                <div key={type} className="flex items-center space-x-2">
                  <Checkbox
                    id={`type-${type}`}
                    checked={typeFilter.includes(type)}
                    onCheckedChange={() => handleTypeToggle(type)}
                  />
                  <Label htmlFor={`type-${type}`} className="cursor-pointer font-normal">
                    {TYPE_LABELS[type]}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Pay Filter */}
          <div className="space-y-3">
            <Label>Stato Pagamento</Label>
            <RadioGroup value={payFilter} onValueChange={(v) => setPayFilter(v as PayFilterType)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="unpaid" id="unpaid" />
                <Label htmlFor="unpaid" className="cursor-pointer font-normal">
                  Solo rate NON pagate
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="paid" id="paid" />
                <Label htmlFor="paid" className="cursor-pointer font-normal">
                  Solo rate PAGATE
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="all" />
                <Label htmlFor="all" className="cursor-pointer font-normal">
                  Tutte (pagate + non pagate)
                </Label>
              </div>
            </RadioGroup>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Totale Anno</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatEuroFromCents(kpis.totalYear)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Media Mensile</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatEuroFromCents(kpis.monthlyAverage)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Picco Massimo</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatEuroFromCents(kpis.maxPeak)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Mesi Attivi</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{kpis.activeMonths} / 12</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Carico Mensile per Tipologia</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(value) => formatEuroFromCents(value)} />
                <Tooltip formatter={(value: number) => formatEuroFromCents(value)} />
                <Legend />
                {typeFilter.map(type => (
                  <Bar 
                    key={type} 
                    dataKey={type} 
                    stackId="a" 
                    fill={TYPE_COLORS[type]} 
                    name={TYPE_LABELS[type]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Saldo Progressivo</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(value) => formatEuroFromCents(value)} />
                <Tooltip formatter={(value: number) => formatEuroFromCents(value)} />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="progressive" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  name="Progressivo"
                  dot={{ fill: "hsl(var(--primary))" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Matrix Table */}
      <Card>
        <CardHeader>
          <CardTitle>Matrice Mensile</CardTitle>
        </CardHeader>
        <CardContent>
          <MatrixTable data={data} yearFilter={yearFilter || currentYear} typeFilter={typeFilter} />
        </CardContent>
      </Card>
    </div>
  );
}

function MatrixTable({ 
  data, 
  yearFilter, 
  typeFilter 
}: { 
  data: any; 
  yearFilter: number; 
  typeFilter: string[];
}) {
  const yearData = data[yearFilter];

  if (!yearData) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nessun dato disponibile per l'anno selezionato
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left p-3 font-semibold sticky left-0 bg-background">Tipologia</th>
            {MONTHS.map((month, idx) => (
              <th key={idx} className="text-right p-3 font-semibold">{month} {yearFilter}</th>
            ))}
            <th className="text-right p-3 font-semibold bg-muted">TOTALE ANNO</th>
          </tr>
        </thead>
        <tbody>
          {typeFilter.map(type => (
            <tr key={type} className="border-b hover:bg-muted/50">
              <td className="p-3 sticky left-0 bg-background">
                <Badge style={{ backgroundColor: TYPE_COLORS[type] }}>
                  {TYPE_LABELS[type]}
                </Badge>
              </td>
              {MONTHS.map((_, idx) => {
                const value = yearData[type]?.[idx + 1] || 0;
                return (
                  <td key={idx} className="text-right p-3 tabular-nums">
                    {formatEuroFromCents(value)}
                  </td>
                );
              })}
              <td className="text-right p-3 font-semibold bg-muted tabular-nums">
                {(() => {
                  const total = Object.values(yearData[type] || {}).reduce((sum: number, v: unknown) => {
                    const num = typeof v === 'number' ? v : 0;
                    return sum + num;
                  }, 0);
                  return formatEuroFromCents(total as number);
                })()}
              </td>
            </tr>
          ))}
          <tr className="border-t-2 font-semibold">
            <td className="p-3 sticky left-0 bg-background">TOTALE</td>
            {MONTHS.map((_, idx) => {
              const value = yearData.totals?.[idx + 1] || 0;
              return (
                <td key={idx} className="text-right p-3 tabular-nums">
                  {formatEuroFromCents(value)}
                </td>
              );
            })}
            <td className="text-right p-3 bg-muted tabular-nums">
              {(() => {
                const total = Object.values(yearData.totals || {}).reduce((sum: number, v: unknown) => {
                  const num = typeof v === 'number' ? v : 0;
                  return sum + num;
                }, 0);
                return formatEuroFromCents(total as number);
              })()}
            </td>
          </tr>
          <tr className="font-bold text-primary bg-primary/5">
            <td className="p-3 sticky left-0 bg-primary/5">PROGRESSIVO</td>
            {MONTHS.map((_, idx) => {
              const value = yearData.progressive?.[idx + 1] || 0;
              return (
                <td key={idx} className="text-right p-3 tabular-nums">
                  {formatEuroFromCents(value)}
                </td>
              );
            })}
            <td className="text-right p-3 bg-primary/10 tabular-nums">
              {formatEuroFromCents(yearData.progressive?.[12] || 0)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function calculateKPIs(data: any, year: number) {
  const yearData = data[year];
  
  if (!yearData || !yearData.totals) {
    return {
      totalYear: 0,
      monthlyAverage: 0,
      maxPeak: 0,
      activeMonths: 0,
    };
  }

  const monthlyTotals = Object.values(yearData.totals).map(v => Number(v) || 0);
  const totalYear = monthlyTotals.reduce((sum, val) => sum + val, 0);
  const activeMonths = monthlyTotals.filter(v => v > 0).length;
  const monthlyAverage = activeMonths > 0 ? totalYear / activeMonths : 0;
  const maxPeak = Math.max(...monthlyTotals, 0);

  return {
    totalYear,
    monthlyAverage,
    maxPeak,
    activeMonths,
  };
}

function prepareChartData(data: any, year: number) {
  const yearData = data[year];
  
  if (!yearData) {
    return MONTHS.map((month) => ({ month, progressive: 0 }));
  }

  return MONTHS.map((month, idx) => {
    const result: any = { month };
    
    // Add each type's data
    Object.keys(TYPE_LABELS).forEach(type => {
      result[type] = Number(yearData[type]?.[idx + 1]) || 0;
    });
    
    // Add progressive
    result.progressive = Number(yearData.progressive?.[idx + 1]) || 0;
    
    return result;
  });
}
