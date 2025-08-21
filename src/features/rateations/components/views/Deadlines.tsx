import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Calendar, Download, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { formatEuro } from '@/lib/formatters';
import { useDeadlines, useDeadlineKPIs, useMonthlyTrends, type DeadlineFilters } from '@/features/rateations/hooks/useDeadlines';
import { useDeadlineCounts } from '@/features/rateations/hooks/useDeadlineCounts';
import { DeadlineFilters as FilterComponent } from '@/features/rateations/components/DeadlineFilters';
import { DeadlineKPICards } from '@/features/rateations/components/DeadlineKPICards';
import { SegmentedPayFilter, type PayFilterValue } from '@/components/SegmentedPayFilter';
import type { RateationRow } from '@/features/rateations/types';

interface DeadlinesProps {
  rows: RateationRow[];
  loading: boolean;
  onBack: () => void;
}

const BUCKET_COLORS = {
  'In ritardo': 'hsl(var(--destructive))',
  'Oggi': 'hsl(var(--warning-foreground))',
  'Entro 7 giorni': 'hsl(var(--warning))',
  'Entro 30 giorni': 'hsl(var(--accent))',
  'Futuro': 'hsl(var(--primary))',
  'Pagata': 'hsl(var(--success))',
};

export function Deadlines({ rows, loading: parentLoading, onBack }: DeadlinesProps) {
  const [payFilter, setPayFilter] = React.useState<PayFilterValue>('all');
  const [filters, setFilters] = React.useState<DeadlineFilters>({
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'), // Next 90 days
    payFilter: 'all',
  });

  // Update filters when payFilter changes
  React.useEffect(() => {
    setFilters(prev => ({ ...prev, payFilter }));
  }, [payFilter]);

  const { data: deadlines = [], isLoading: deadlinesLoading } = useDeadlines(filters);
  const { data: kpis, isLoading: kpisLoading } = useDeadlineKPIs(filters);
  const { data: monthlyTrends = [], isLoading: trendsLoading } = useMonthlyTrends(12);
  const { data: counts = { paid: 0, unpaid: 0, total: 0 }, isLoading: countsLoading } = useDeadlineCounts(filters);

  const loading = parentLoading || deadlinesLoading;

  // Prepare monthly trend data for chart
  const chartData = React.useMemo(() => {
    const months = Array.from(new Set(monthlyTrends.map(t => t.due_month))).sort();
    return months.map(month => {
      const monthData = { month };
      const buckets = ['In ritardo', 'Oggi', 'Entro 7 giorni', 'Entro 30 giorni', 'Futuro', 'Pagata'];
      buckets.forEach(bucket => {
        const trend = monthlyTrends.find(t => t.due_month === month && t.bucket === bucket);
        monthData[bucket] = trend?.amount || 0;
      });
      return monthData;
    });
  }, [monthlyTrends]);

  const exportToCSV = () => {
    const headers = ['Numero', 'Contribuente', 'Rata', 'Scadenza', 'Importo', 'Stato', 'Tipo'];
    const csvContent = [
      headers.join(','),
      ...deadlines.map(d => [
        d.rateation_number,
        d.taxpayer_name || '',
        d.seq,
        d.due_date,
        d.amount,
        d.bucket,
        d.type_name
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scadenze-${payFilter}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading && !kpis) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={onBack} size="sm" disabled>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Indietro
          </Button>
          <div>
            <h2 className="text-2xl font-bold">Scadenze</h2>
            <p className="text-muted-foreground">Analisi dettagliata delle scadenze</p>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <Skeleton className="h-96 col-span-1" />
          <div className="col-span-3 space-y-6">
            <Skeleton className="h-24" />
            <Skeleton className="h-64" />
            <Skeleton className="h-48" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={onBack} size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Indietro
          </Button>
          <div>
            <h2 className="text-2xl font-bold">Scadenze</h2>
            <p className="text-muted-foreground">Analisi dettagliata delle scadenze</p>
          </div>
        </div>
        <Button variant="outline" onClick={exportToCSV} disabled={!deadlines.length}>
          <Download className="h-4 w-4 mr-2" />
          Esporta CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Filters Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <FilterComponent filters={filters} onFiltersChange={setFilters} />
          
          {/* Payment Status Filter */}
          <Card className="p-4">
            <h3 className="font-semibold mb-3">Stato Pagamento</h3>
            <SegmentedPayFilter
              value={payFilter}
              onChange={setPayFilter}
              counts={counts}
              loading={countsLoading}
            />
          </Card>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-6">
          {/* KPI Cards */}
          {kpis && <DeadlineKPICards kpis={kpis} loading={kpisLoading} />}

          {/* Monthly Trend Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Trend Mensile (Prossimi 12 Mesi)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {trendsLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="month" 
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => format(new Date(value), 'MMM', { locale: it })}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip 
                      formatter={(value, name) => [formatEuro(Number(value)), name]}
                      labelFormatter={(label) => format(new Date(label), 'MMMM yyyy', { locale: it })}
                    />
                    <Legend />
                    {Object.entries(BUCKET_COLORS).map(([bucket, color]) => (
                      <Bar 
                        key={bucket} 
                        dataKey={bucket} 
                        stackId="a" 
                        fill={color}
                        name={bucket}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Deadlines Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Elenco Scadenze ({deadlines.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {deadlinesLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : deadlines.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Numero</TableHead>
                      <TableHead>Contribuente</TableHead>
                      <TableHead>Rata</TableHead>
                      <TableHead>Scadenza</TableHead>
                      <TableHead>Importo</TableHead>
                      <TableHead>Stato</TableHead>
                      <TableHead>Tipo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deadlines.slice(0, 50).map((deadline) => (
                      <TableRow key={`${deadline.rateation_id}-${deadline.seq}`}>
                        <TableCell className="font-medium">{deadline.rateation_number}</TableCell>
                        <TableCell>{deadline.taxpayer_name || '-'}</TableCell>
                        <TableCell>{deadline.seq}</TableCell>
                        <TableCell>
                          {format(new Date(deadline.due_date), 'dd/MM/yyyy', { locale: it })}
                          {deadline.days_overdue > 0 && (
                            <div className="text-xs text-muted-foreground">
                              +{deadline.days_overdue} giorni
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{formatEuro(deadline.amount)}</TableCell>
                        <TableCell>
                           <Badge 
                            variant={
                              deadline.bucket === 'In ritardo' ? 'destructive' :
                              deadline.bucket === 'Oggi' ? 'secondary' :
                              deadline.bucket === 'Entro 7 giorni' ? 'secondary' :
                              deadline.bucket === 'Pagata' ? 'default' : 'outline'
                            }
                          >
                            {deadline.bucket}
                          </Badge>
                        </TableCell>
                        <TableCell>{deadline.type_name}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Nessuna scadenza trovata con i filtri selezionati</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}