import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Download, Printer, TrendingUp, TrendingDown } from 'lucide-react';
import { useMonthlyMatrix, type MatrixData } from '@/features/rateations/hooks/useMonthlyMatrix';
import { formatEuro } from '@/lib/formatters';
import { cn } from '@/lib/utils';

type MetricType = 'due' | 'paid' | 'overdue' | 'extra_ravv';

interface AnnualMatrixProps {
  onBack?: () => void;
}

const MONTH_NAMES = [
  'Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu',
  'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'
];

const METRIC_LABELS: Record<MetricType, string> = {
  due: 'Dovuto',
  paid: 'Pagato',
  overdue: 'In Ritardo',
  extra_ravv: 'Ravvedimento'
};

export default function AnnualMatrix({ onBack }: AnnualMatrixProps) {
  const { data, years, loading, error } = useMonthlyMatrix();
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('due');
  const [showYoY, setShowYoY] = useState(false);

  const maxValue = useMemo(() => {
    let max = 0;
    Object.values(data).forEach(yearData => {
      Object.values(yearData).forEach(monthData => {
        const value = getMetricValue(monthData, selectedMetric);
        if (value > max) max = value;
      });
    });
    return max;
  }, [data, selectedMetric]);

  const getMetricValue = (monthData: any, metric: MetricType): number => {
    switch (metric) {
      case 'due': return Number(monthData.due_amount || 0);
      case 'paid': return Number(monthData.paid_amount || 0);
      case 'overdue': return Number(monthData.overdue_amount || 0);
      case 'extra_ravv': return Number(monthData.extra_ravv_amount || 0);
      default: return 0;
    }
  };

  const getHeatmapColor = (value: number): string => {
    if (maxValue === 0) return 'bg-muted/20';
    const intensity = value / maxValue;
    
    if (intensity === 0) return 'bg-muted/20';
    if (intensity <= 0.2) return 'bg-primary/20';
    if (intensity <= 0.4) return 'bg-primary/40';
    if (intensity <= 0.6) return 'bg-primary/60';
    if (intensity <= 0.8) return 'bg-primary/80';
    return 'bg-primary';
  };

  const getYoYChange = (year: number, month: number): number | null => {
    const prevYear = year - 1;
    if (!data[prevYear] || !data[year]) return null;
    
    const current = getMetricValue(data[year][month], selectedMetric);
    const previous = getMetricValue(data[prevYear][month], selectedMetric);
    
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const exportCSV = () => {
    const csvRows: string[] = [];
    
    // Header
    const header = ['Anno', ...MONTH_NAMES, 'Totale'];
    csvRows.push(header.join(';'));
    
    // Data rows
    years.forEach(year => {
      const row = [year.toString()];
      let yearTotal = 0;
      
      for (let month = 1; month <= 12; month++) {
        const value = getMetricValue(data[year]?.[month] || {}, selectedMetric);
        yearTotal += value;
        row.push(value.toLocaleString('it-IT', { minimumFractionDigits: 2 }));
      }
      
      row.push(yearTotal.toLocaleString('it-IT', { minimumFractionDigits: 2 }));
      csvRows.push(row.join(';'));
    });
    
    // Monthly totals row
    const totalsRow = ['TOTALE'];
    let grandTotal = 0;
    
    for (let month = 1; month <= 12; month++) {
      let monthTotal = 0;
      years.forEach(year => {
        monthTotal += getMetricValue(data[year]?.[month] || {}, selectedMetric);
      });
      grandTotal += monthTotal;
      totalsRow.push(monthTotal.toLocaleString('it-IT', { minimumFractionDigits: 2 }));
    }
    
    totalsRow.push(grandTotal.toLocaleString('it-IT', { minimumFractionDigits: 2 }));
    csvRows.push(totalsRow.join(';'));
    
    // Download
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `matrice-${METRIC_LABELS[selectedMetric].toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            Caricamento matrice...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-destructive">
            Errore nel caricamento: {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (years.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            {onBack && (
              <Button variant="ghost" size="sm" onClick={onBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <CardTitle>Matrice Annuale</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            Nessun dato disponibile per la matrice annuale.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {onBack && (
              <Button variant="ghost" size="sm" onClick={onBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <CardTitle>Matrice Annuale - {METRIC_LABELS[selectedMetric]}</CardTitle>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowYoY(!showYoY)}>
              <TrendingUp className="h-4 w-4 mr-2" />
              YoY
            </Button>
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="h-4 w-4 mr-2" />
              CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.open('/print/annual-matrix', '_blank')}>
              <Printer className="h-4 w-4 mr-2" />
              Stampa
            </Button>
          </div>
        </div>
        
        {/* Metric Selector */}
        <div className="flex gap-2 flex-wrap">
          {(Object.keys(METRIC_LABELS) as MetricType[]).map(metric => (
            <Button
              key={metric}
              variant={selectedMetric === metric ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedMetric(metric)}
            >
              {METRIC_LABELS[metric]}
            </Button>
          ))}
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr>
                <th className="text-left p-2 font-medium border-b">Anno</th>
                {MONTH_NAMES.map(month => (
                  <th key={month} className="text-center p-2 font-medium border-b w-20">
                    {month}
                  </th>
                ))}
                <th className="text-center p-2 font-medium border-b w-24">Tot</th>
              </tr>
            </thead>
            <tbody>
              {years.map(year => {
                const yearTotal = Array.from({ length: 12 }, (_, i) => i + 1)
                  .reduce((sum, month) => sum + getMetricValue(data[year]?.[month] || {}, selectedMetric), 0);
                
                return (
                  <tr key={year}>
                    <td className="p-2 font-medium border-b">{year}</td>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(month => {
                      const value = getMetricValue(data[year]?.[month] || {}, selectedMetric);
                      const yoyChange = showYoY ? getYoYChange(year, month) : null;
                      
                      return (
                        <td key={month} className="p-1 border-b">
                          <div className={cn(
                            "rounded p-2 text-xs text-center relative",
                            getHeatmapColor(value),
                            value > maxValue * 0.6 ? "text-white" : "text-foreground"
                          )}>
                            <div className="font-medium">
                              {value > 999 ? `${Math.round(value/1000)}k` : Math.round(value)}
                            </div>
                            {showYoY && yoyChange !== null && (
                              <div className={cn(
                                "flex items-center justify-center gap-1",
                                yoyChange > 0 ? "text-green-600" : yoyChange < 0 ? "text-red-600" : "text-muted-foreground"
                              )}>
                                {yoyChange > 0 ? (
                                  <TrendingUp className="h-3 w-3" />
                                ) : yoyChange < 0 ? (
                                  <TrendingDown className="h-3 w-3" />
                                ) : null}
                                <span>{Math.abs(yoyChange).toFixed(0)}%</span>
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                    <td className="p-2 text-center font-medium border-b">
                      {formatEuro(yearTotal)}
                    </td>
                  </tr>
                );
              })}
              
              {/* Monthly Totals Row */}
              <tr className="bg-muted/50">
                <td className="p-2 font-bold">TOT</td>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(month => {
                  const monthTotal = years.reduce((sum, year) => 
                    sum + getMetricValue(data[year]?.[month] || {}, selectedMetric), 0
                  );
                  
                  return (
                    <td key={month} className="p-2 text-center font-medium">
                      {formatEuro(monthTotal)}
                    </td>
                  );
                })}
                <td className="p-2 text-center font-bold">
                  {formatEuro(
                    years.reduce((sum, year) => 
                      sum + Array.from({ length: 12 }, (_, i) => i + 1)
                        .reduce((yearSum, month) => 
                          yearSum + getMetricValue(data[year]?.[month] || {}, selectedMetric), 0
                        ), 0
                    )
                  )}
                </td>
              </tr>
              
              {/* Monthly Averages Row */}
              <tr className="bg-muted/30">
                <td className="p-2 font-medium">MEDIA</td>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(month => {
                  const monthTotal = years.reduce((sum, year) => 
                    sum + getMetricValue(data[year]?.[month] || {}, selectedMetric), 0
                  );
                  const monthAverage = years.length > 0 ? monthTotal / years.length : 0;
                  
                  return (
                    <td key={month} className="p-2 text-center text-sm">
                      {formatEuro(monthAverage)}
                    </td>
                  );
                })}
                <td className="p-2 text-center font-medium">
                  {formatEuro(
                    years.reduce((sum, year) => 
                      sum + Array.from({ length: 12 }, (_, i) => i + 1)
                        .reduce((yearSum, month) => 
                          yearSum + getMetricValue(data[year]?.[month] || {}, selectedMetric), 0
                        ), 0
                    ) / (years.length || 1)
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        
        {/* Legend */}
        <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
          <div>Intensità colore: proporzionale al valore</div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-primary/20 rounded"></div>
            <span>Basso</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-primary rounded"></div>
            <span>Alto</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}