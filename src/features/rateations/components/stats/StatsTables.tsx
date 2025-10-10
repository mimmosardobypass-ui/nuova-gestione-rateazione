import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { StatsByType, StatsByStatus, StatsByTaxpayer, StatsCashflowMonthly, StatsFilters } from "../../types/stats";
import { formatEuroFromCents } from "@/lib/formatters";
import { formatMonth } from "../../utils/statsFormatters";
import { useStatsByTypeEffective } from "../../hooks/useStatsByTypeEffective";

interface StatsTablesProps {
  activeFilters: StatsFilters;
  byStatus: StatsByStatus[];
  byTaxpayer: StatsByTaxpayer[];
  cashflow: StatsCashflowMonthly[];
}

export function StatsTables({ activeFilters, byStatus, byTaxpayer, cashflow }: StatsTablesProps) {
  // Usa hook dedicato per "Per Tipologia" con regola F24↔PagoPA
  const { byType, loading: typeLoading, error: typeError } = useStatsByTypeEffective(activeFilters);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Per Tipologia</CardTitle>
        </CardHeader>
        <CardContent>
          {typeError && (
            <div className="text-destructive text-sm mb-4">
              Errore: {typeError}
            </div>
          )}
          {typeLoading ? (
            <div className="text-muted-foreground text-center py-4">
              Caricamento...
            </div>
          ) : byType.length === 0 ? (
            <div className="text-muted-foreground text-center py-4">
              Nessun dato disponibile per il periodo selezionato
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Conteggio</TableHead>
                  <TableHead className="text-right">Totale</TableHead>
                  <TableHead className="text-right">Pagato</TableHead>
                  <TableHead className="text-right">Residuo</TableHead>
                  <TableHead className="text-right">In Ritardo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byType.map((row, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{row.type_label}</TableCell>
                    <TableCell className="text-right">{row.count}</TableCell>
                    <TableCell className="text-right">{formatEuroFromCents(row.total_amount_cents)}</TableCell>
                    <TableCell className="text-right">{formatEuroFromCents(row.paid_amount_cents)}</TableCell>
                    <TableCell className="text-right">{formatEuroFromCents(row.residual_amount_cents)}</TableCell>
                    <TableCell className="text-right">{formatEuroFromCents(row.overdue_amount_cents)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Per Stato</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Stato</TableHead>
                <TableHead className="text-right">Conteggio</TableHead>
                <TableHead className="text-right">Totale</TableHead>
                <TableHead className="text-right">Pagato</TableHead>
                <TableHead className="text-right">Residuo</TableHead>
                <TableHead className="text-right">In Ritardo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byStatus.map((row, idx) => (
                <TableRow key={idx}>
                  <TableCell>{row.status}</TableCell>
                  <TableCell className="text-right">{row.count}</TableCell>
                  <TableCell className="text-right">{formatEuroFromCents(row.total_amount_cents)}</TableCell>
                  <TableCell className="text-right">{formatEuroFromCents(row.paid_amount_cents)}</TableCell>
                  <TableCell className="text-right">{formatEuroFromCents(row.residual_amount_cents)}</TableCell>
                  <TableCell className="text-right">{formatEuroFromCents(row.overdue_amount_cents)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top Contribuenti (max 50)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contribuente</TableHead>
                <TableHead className="text-right">Conteggio</TableHead>
                <TableHead className="text-right">Totale</TableHead>
                <TableHead className="text-right">Pagato</TableHead>
                <TableHead className="text-right">Residuo</TableHead>
                <TableHead className="text-right">In Ritardo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byTaxpayer.slice(0, 50).map((row, idx) => (
                <TableRow key={idx}>
                  <TableCell>{row.taxpayer_name || 'Sconosciuto'}</TableCell>
                  <TableCell className="text-right">{row.count}</TableCell>
                  <TableCell className="text-right">{formatEuroFromCents(row.total_amount_cents)}</TableCell>
                  <TableCell className="text-right">{formatEuroFromCents(row.paid_amount_cents)}</TableCell>
                  <TableCell className="text-right">{formatEuroFromCents(row.residual_amount_cents)}</TableCell>
                  <TableCell className="text-right">{formatEuroFromCents(row.overdue_amount_cents)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cashflow Mensile</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mese</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Dovuto</TableHead>
                <TableHead className="text-right">Pagato</TableHead>
                <TableHead className="text-right">Non Pagato</TableHead>
                <TableHead className="text-right">In Ritardo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cashflow.map((row, idx) => (
                <TableRow key={idx}>
                  <TableCell>{formatMonth(row.month)}</TableCell>
                  <TableCell className="text-right">{row.installments_count}</TableCell>
                  <TableCell className="text-right">{formatEuroFromCents(row.due_amount_cents)}</TableCell>
                  <TableCell className="text-right">{formatEuroFromCents(row.paid_amount_cents)}</TableCell>
                  <TableCell className="text-right">{formatEuroFromCents(row.unpaid_amount_cents)}</TableCell>
                  <TableCell className="text-right">{formatEuroFromCents(row.overdue_amount_cents)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
