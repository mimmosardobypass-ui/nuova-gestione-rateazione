import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, TrendingUp, DollarSign, CheckCircle2 } from 'lucide-react';
import type { AdvStatsFilters } from '../../types/advStats';
import { useAdvancedStats } from '../../hooks/useAdvancedStats';

function getDefaultFilters(): AdvStatsFilters {
  const today = new Date();
  const year = today.getFullYear();
  return {
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`,
    typeLabels: null,
    statuses: null,
    taxpayerSearch: null,
    ownerOnly: false,
    includeClosed: false,
    groupBy: 'ref',
  };
}

export default function AdvancedStatsView() {
  
  const [filters, setFilters] = useState<AdvStatsFilters>(getDefaultFilters());
  const { data, loading, error } = useAdvancedStats(filters);

  const formatCurrency = (cents: number) => {
    return `€ ${(cents / 100).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Statistiche Avanzate V2</h1>
          <p className="text-muted-foreground mt-1">Dashboard statistiche con filtri avanzati e serie temporale</p>
        </div>
        <div className="px-3 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full">
          🧪 Beta
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Errore</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {data?.errors && data.errors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Validazione Parametri</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4 mt-2">
              {data.errors.map((err, i) => <li key={i}>{err}</li>)}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Filtri */}
      <Card>
        <CardHeader>
          <CardTitle>Filtri</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={filters.ownerOnly}
                onChange={(e) => setFilters(f => ({ ...f, ownerOnly: e.target.checked }))}
                className="rounded border-input"
              />
              <span className="text-sm">Solo mie rateazioni</span>
            </label>
            
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={filters.includeClosed}
                onChange={(e) => setFilters(f => ({ ...f, includeClosed: e.target.checked }))}
                className="rounded border-input"
              />
              <span className="text-sm">Include interrotte/estinte</span>
            </label>
            
            <div className="flex items-center gap-2">
              <span className="text-sm">Raggruppa per:</span>
              <select
                value={filters.groupBy}
                onChange={(e) => setFilters(f => ({ ...f, groupBy: e.target.value as 'ref' | 'created' }))}
                className="rounded border-input px-2 py-1 text-sm"
              >
                <option value="ref">Scadenza (due_date)</option>
                <option value="created">Creazione (created_at)</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Totale</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '...' : formatCurrency(data?.kpi.total_amount_cents ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Importo totale rateazioni</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Residuo</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '...' : formatCurrency(data?.kpi.residual_amount_cents ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Da pagare</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pagato</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '...' : formatCurrency(data?.kpi.paid_amount_cents ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Già versato</p>
          </CardContent>
        </Card>
      </div>

      {/* Per Tipologia */}
      <Card>
        <CardHeader>
          <CardTitle>Per Tipologia</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Caricamento...</p>
          ) : (data?.by_type ?? []).length === 0 ? (
            <p className="text-muted-foreground">Nessun dato disponibile</p>
          ) : (
            <div className="space-y-2">
              {(data?.by_type ?? []).map((item, i) => (
                <div key={i} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                  <span className="font-medium">{item.type_label}</span>
                  <span className="text-muted-foreground">{formatCurrency(item.total_amount_cents)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Per Stato */}
      <Card>
        <CardHeader>
          <CardTitle>Per Stato</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Caricamento...</p>
          ) : (data?.by_status ?? []).length === 0 ? (
            <p className="text-muted-foreground">Nessun dato disponibile</p>
          ) : (
            <div className="space-y-2">
              {(data?.by_status ?? []).map((item, i) => (
                <div key={i} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                  <span className="font-medium capitalize">{item.status}</span>
                  <span className="text-muted-foreground">{item.count.toLocaleString()} rateazioni</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top 10 Contribuenti */}
      <Card>
        <CardHeader>
          <CardTitle>Top 10 Contribuenti</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Caricamento...</p>
          ) : (data?.top_taxpayers ?? []).length === 0 ? (
            <p className="text-muted-foreground">Nessun dato disponibile</p>
          ) : (
            <div className="space-y-2">
              {(data?.top_taxpayers ?? []).map((item, i) => (
                <div key={i} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
                      {i + 1}
                    </div>
                    <span className="font-medium">{item.taxpayer_name ?? '—'}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{formatCurrency(item.amount_cents)}</div>
                    <div className="text-xs text-muted-foreground">{item.count} rateazioni</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Metadata */}
      {data?.meta && (
        <Card>
          <CardHeader>
            <CardTitle>Metadata</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Versione:</span>
                <span className="font-mono">{data.meta.version}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Raggruppamento:</span>
                <span className="font-mono">{data.meta.group_by}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Generato:</span>
                <span className="font-mono text-xs">{new Date(data.meta.generated_at).toLocaleString('it-IT')}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
