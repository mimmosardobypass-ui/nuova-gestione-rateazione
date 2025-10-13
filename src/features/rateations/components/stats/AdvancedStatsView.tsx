import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, TrendingUp, DollarSign, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { TypeMultiSelect } from './TypeMultiSelect';
import { useAdvancedStatsV2 } from '../../hooks/useAdvancedStatsV2';
import { formatEuroFromCents, formatMonth } from '@/lib/formatters';
import type { RateType, GroupBy } from '../../types/advStats';

function getDefaultFilters() {
  const today = new Date();
  const year = today.getFullYear();
  return {
    types: [] as RateType[],
    includeInterrupted: false,
    groupBy: 'due' as GroupBy,
    dateFrom: `${year}-01-01`,
    dateTo: `${year}-12-31`,
  };
}

function labelFromType(t: string): string {
  switch (t) {
    case "F24": return "F24";
    case "PAGOPA": return "PagoPA";
    case "ROTTAMAZIONE_QUATER": return "Rottamazione Quater";
    case "RIAMMISSIONE_QUATER": return "Riammissione Quater";
    case "ALTRO": return "Altro";
    default: return t;
  }
}

export default function AdvancedStatsView() {
  const [filters, setFilters] = useState(getDefaultFilters());
  const { data, loading, error, reload } = useAdvancedStatsV2(filters);

  const totals = data?.totals ?? { total_cents:0, residual_cents:0, paid_cents:0 };
  const byType = data?.by_type ?? [];
  const series = data?.series ?? [];
  
  // Serie temporale formattata per Recharts
  const seriesChart = series.map(s => ({ 
    month: formatMonth(s.month), 
    Totale: s.total_cents/100, 
    Residuo: s.residual_cents/100, 
    Pagato: s.paid_cents/100 
  }));

  const resetFilters = () => {
    setFilters(getDefaultFilters());
  };

  return (
    <div className="container mx-auto py-6 space-y-6 min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Statistiche Avanzate V2</h1>
          <p className="text-muted-foreground mt-1">Dashboard unificata con RPC performante</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={reload} disabled={loading}>
            🔄 Ricarica
          </Button>
          <div className="px-3 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full">
            ⚡ V2
          </div>
        </div>
      </div>

      {/* Errori */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Errore RPC</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* FILTRI */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Filtri</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            {/* Multi-select Tipologie */}
            <TypeMultiSelect 
              value={filters.types} 
              onChange={(types) => setFilters(f => ({ ...f, types }))} 
            />
            
            {/* Switch Interrotte */}
            <div className="flex items-center gap-2">
              <Switch 
                id="incInt" 
                checked={filters.includeInterrupted} 
                onCheckedChange={(includeInterrupted) => setFilters(f => ({ ...f, includeInterrupted }))} 
              />
              <Label htmlFor="incInt" className="cursor-pointer">
                Includi interrotte/estinte
              </Label>
            </div>
            
            {/* Select GroupBy */}
            <Select 
              value={filters.groupBy} 
              onValueChange={(groupBy) => setFilters(f => ({ ...f, groupBy: groupBy as GroupBy }))}
            >
              <SelectTrigger className="w-[240px]">
                <SelectValue placeholder="Raggruppa per" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="due">Scadenza (due_date)</SelectItem>
                <SelectItem value="created">Data creazione</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Reset Button */}
            <Button variant="outline" onClick={resetFilters}>
              Reset filtri
            </Button>
          </div>
          
          {/* Filtri Date (opzionali - placeholder per futuro DatePicker) */}
          <div className="text-xs text-muted-foreground">
            Periodo: {filters.dateFrom ?? '—'} → {filters.dateTo ?? '—'}
          </div>
        </CardContent>
      </Card>

      {/* CARDS KPI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Totale</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-8 w-32 animate-pulse rounded-md bg-muted" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {formatEuroFromCents(totals.total_cents)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Importo totale rateazioni</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Residuo</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-8 w-32 animate-pulse rounded-md bg-muted" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {formatEuroFromCents(totals.residual_cents)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Da pagare</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pagato</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-8 w-32 animate-pulse rounded-md bg-muted" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {formatEuroFromCents(totals.paid_cents)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Già versato</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* SERIE TEMPORALE */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Andamento Mensile</CardTitle>
          <p className="text-sm text-muted-foreground">
            Raggruppamento: {filters.groupBy === 'due' ? 'Scadenza' : 'Creazione'}
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-[320px] animate-pulse rounded-md bg-muted" />
          ) : error ? (
            <div className="text-destructive">Errore caricamento serie temporale</div>
          ) : seriesChart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[320px] text-muted-foreground">
              <TrendingUp className="h-12 w-12 mb-2 opacity-30" />
              <p>Nessun dato nel periodo selezionato</p>
            </div>
          ) : (
            <div className="h-[360px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={seriesChart} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis 
                    dataKey="month" 
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis 
                    tickFormatter={(v) => `€${v.toLocaleString('it-IT')}`}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip 
                    formatter={(v: number) => v.toLocaleString('it-IT', {style:'currency', currency:'EUR'})}
                    labelStyle={{ fontWeight: 'bold' }}
                  />
                  <Legend 
                    wrapperStyle={{ paddingTop: '20px' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="Totale" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="Residuo" 
                    stroke="hsl(var(--destructive))" 
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="Pagato" 
                    stroke="hsl(var(--chart-2))" 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* BREAKDOWN PER TIPOLOGIA */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Per Tipologia</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : byType.length === 0 ? (
            <div className="text-muted-foreground py-8 text-center">
              Nessuna tipologia nel filtro corrente
            </div>
          ) : (
            <div className="space-y-2">
              {byType.map((r) => (
                <div 
                  key={r.type} 
                  className="flex items-center justify-between rounded-lg border px-4 py-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="font-medium">{labelFromType(r.type)}</div>
                  <div className="flex gap-6 text-sm">
                    <div>
                      <span className="text-muted-foreground mr-1">Totale:</span>
                      <span className="font-medium">{formatEuroFromCents(r.total_cents)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground mr-1">Residuo:</span>
                      <span className="font-medium">{formatEuroFromCents(r.residual_cents)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground mr-1">Pagato:</span>
                      <span className="font-medium">{formatEuroFromCents(r.paid_cents)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Debug Info (solo dev) */}
      {import.meta.env.DEV && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Debug Info (dev only)</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs overflow-auto max-h-[200px] bg-muted p-2 rounded">
              {JSON.stringify({ filters, totals, byTypeCount: byType.length, seriesCount: series.length }, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
