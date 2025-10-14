import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { useDeadlines, useDeadlineKPIs, type DeadlineFilters } from '@/features/rateations/hooks/useDeadlines';
import PrintLayout from '@/components/print/PrintLayout';
import { PrintKpi } from '@/components/print/PrintKpi';
import { formatEuro } from '@/lib/formatters';
import '@/styles/print.css';

export default function ScadenzePrint() {
  const [searchParams] = useSearchParams();

  const filters: DeadlineFilters = {
    startDate: searchParams.get('startDate') || undefined,
    endDate: searchParams.get('endDate') || undefined,
    typeIds: searchParams.get('typeIds')?.split(',').map(Number).filter(Boolean) || undefined,
    bucket: searchParams.get('bucket') || 'all',
    search: searchParams.get('search') || undefined,
    payFilter: (searchParams.get('payFilter') as 'paid' | 'unpaid' | 'all') || 'all',
  };

  const { data: deadlines = [], isLoading: deadlinesLoading } = useDeadlines(filters);
  const { data: kpis, isLoading: kpisLoading } = useDeadlineKPIs(filters);

  // Auto-trigger print dialog when data is loaded
  React.useEffect(() => {
    if (!deadlinesLoading && !kpisLoading && kpis && deadlines) {
      const timer = setTimeout(() => {
        window.print();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [deadlinesLoading, kpisLoading, kpis, deadlines]);

  const logoUrl = searchParams.get('logo') || undefined;
  const theme = searchParams.get('theme') || 'bn';

  if (deadlinesLoading || kpisLoading || !kpis) {
    return (
      <PrintLayout title="Report Scadenze" logoUrl={logoUrl}>
        <div className="text-center py-8">Caricamento dati...</div>
      </PrintLayout>
    );
  }

  const subtitle = [
    filters.startDate && filters.endDate
      ? `${format(new Date(filters.startDate), 'dd/MM/yyyy')} - ${format(new Date(filters.endDate), 'dd/MM/yyyy')}`
      : 'Tutte le date',
    filters.payFilter === 'paid' ? 'Solo pagate' : filters.payFilter === 'unpaid' ? 'Solo non pagate' : 'Tutte',
    filters.bucket && filters.bucket !== 'all' ? filters.bucket : 'Tutti i bucket',
  ].join(' • ');

  return (
    <PrintLayout
      title="Report Scadenze"
      subtitle={subtitle}
      logoUrl={logoUrl}
      bodyClass={theme === 'color' ? '' : 'theme-bn'}
    >
      {/* KPI Section */}
      <div className="print-section">
        <h2 className="text-xl font-bold mb-4">Riepilogo</h2>
        <div className="grid grid-cols-4 gap-4 mb-6">
          <PrintKpi label="Totale Scadenze" value={String(kpis.total_count)} />
          <PrintKpi label="Importo Totale" value={formatEuro(kpis.total_amount)} />
          <PrintKpi 
            label="Saldo Da Pagare" 
            value={formatEuro(kpis.saldo_da_pagare)} 
            className="col-span-2 bg-primary/5 border-primary/20"
          />
        </div>

        <div className="grid grid-cols-5 gap-4">
          <PrintKpi label="In Ritardo" value={`${kpis.in_ritardo_count} (${formatEuro(kpis.in_ritardo_amount)})`} />
          <PrintKpi label="Entro 7 giorni" value={`${kpis.entro_7_count} (${formatEuro(kpis.entro_7_amount)})`} />
          <PrintKpi label="Entro 30 giorni" value={`${kpis.entro_30_count} (${formatEuro(kpis.entro_30_amount)})`} />
          <PrintKpi label="Future" value={`${kpis.futuro_count} (${formatEuro(kpis.futuro_amount)})`} />
          <PrintKpi label="Pagate" value={`${kpis.pagata_count} (${formatEuro(kpis.pagata_amount)})`} />
        </div>
      </div>

      {/* Deadlines Table */}
      <div className="print-section">
        <h2 className="text-xl font-bold mb-4">Dettaglio Scadenze ({deadlines.length})</h2>
        
        {deadlines.length > 0 ? (
          <table className="print-table">
            <thead>
              <tr>
                <th>Numero</th>
                <th>Contribuente</th>
                <th>Rata</th>
                <th>Scadenza</th>
                <th>Importo</th>
                <th>Stato</th>
                <th>Tipo</th>
                <th>Bucket</th>
              </tr>
            </thead>
            <tbody>
              {deadlines.map((deadline, index) => (
                <tr key={`${deadline.rateation_id}-${deadline.seq}`}>
                  <td>{deadline.rateation_number}</td>
                  <td>{deadline.taxpayer_name || '-'}</td>
                  <td>{deadline.seq}</td>
                  <td>
                    {format(new Date(deadline.due_date), 'dd/MM/yyyy', { locale: it })}
                    {deadline.days_overdue > 0 && (
                      <span className="text-xs text-muted-foreground"> (+{deadline.days_overdue}g)</span>
                    )}
                  </td>
                  <td className="text-right">{formatEuro(deadline.amount)}</td>
                  <td>{deadline.is_paid ? 'Pagata' : 'Non pagata'}</td>
                  <td>{deadline.type_name}</td>
                  <td>
                    <span className={`print-badge ${deadline.bucket === 'In ritardo' ? 'badge-destructive' : ''}`}>
                      {deadline.bucket}
                    </span>
                  </td>
                </tr>
              ))}
              <tr className="font-bold border-t-2">
                <td colSpan={2}>TOTALE</td>
                <td>{deadlines.length}</td>
                <td></td>
                <td className="text-right">{formatEuro(deadlines.reduce((sum, d) => sum + d.amount, 0))}</td>
                <td colSpan={3}></td>
              </tr>
            </tbody>
          </table>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Nessuna scadenza trovata con i filtri selezionati
          </div>
        )}
      </div>
    </PrintLayout>
  );
}
