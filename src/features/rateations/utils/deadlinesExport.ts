import { utils, writeFile } from 'xlsx';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import type { DeadlineItem, DeadlineKPIs, DeadlineFilters } from '@/features/rateations/hooks/useDeadlines';
import { formatEuro } from '@/lib/formatters';

export function exportDeadlinesToExcel(
  deadlines: DeadlineItem[],
  kpis: DeadlineKPIs,
  filters: DeadlineFilters
) {
  const workbook = utils.book_new();

  // Prepare header info
  const headerInfo = [
    ['REPORT SCADENZE'],
    [''],
    ['Filtri Applicati:'],
    ['Periodo', filters.startDate && filters.endDate 
      ? `${format(new Date(filters.startDate), 'dd/MM/yyyy')} - ${format(new Date(filters.endDate), 'dd/MM/yyyy')}` 
      : 'Tutti'],
    ['Stato pagamento', filters.payFilter === 'paid' ? 'Solo pagate' : filters.payFilter === 'unpaid' ? 'Solo non pagate' : 'Tutte'],
    ['Bucket', filters.bucket && filters.bucket !== 'all' ? filters.bucket : 'Tutti'],
    ['Ricerca', filters.search || 'Nessuna'],
    [''],
    ['KPI PRINCIPALI:'],
    ['Totale Scadenze', kpis.total_count],
    ['Importo Totale', formatEuro(kpis.total_amount)],
    ['SALDO DA PAGARE', formatEuro(kpis.saldo_da_pagare)],
    ['In Ritardo', `${kpis.in_ritardo_count} rate (${formatEuro(kpis.in_ritardo_amount)})`],
    ['Entro 7 giorni', `${kpis.entro_7_count} rate (${formatEuro(kpis.entro_7_amount)})`],
    ['Entro 30 giorni', `${kpis.entro_30_count} rate (${formatEuro(kpis.entro_30_amount)})`],
    ['Future', `${kpis.futuro_count} rate (${formatEuro(kpis.futuro_amount)})`],
    ['Pagate', `${kpis.pagata_count} rate (${formatEuro(kpis.pagata_amount)})`],
    [''],
    ['DETTAGLIO SCADENZE:'],
  ];

  // Prepare table headers
  const tableHeaders = [
    'Numero',
    'Contribuente',
    'Rata',
    'Scadenza',
    'Importo (€)',
    'Stato',
    'Rate Saltate',
    'Bucket',
    'Giorni Ritardo',
  ];

  // Prepare table data
  const tableData = deadlines.map((d) => [
    d.rateation_number || '',
    d.taxpayer_name || '',
    d.seq,
    d.due_date ? format(new Date(d.due_date), 'dd/MM/yyyy', { locale: it }) : '',
    (d.amount / 100).toFixed(2),
    d.is_paid ? 'Pagata' : 'Non pagata',
    d.is_pagopa ? `${d.skip_remaining ?? '-'}/${d.max_skips_effective ?? 8}` : '-',
    d.bucket || '',
    d.days_overdue > 0 ? d.days_overdue : '',
  ]);

  // Add total row
  const totalAmount = deadlines.reduce((sum, d) => sum + d.amount, 0);
  const totalRow = [
    'TOTALE',
    '',
    deadlines.length,
    '',
    (totalAmount / 100).toFixed(2),
    '',
    '',
    '',
    '',
  ];

  // Combine all data
  const sheetData = [
    ...headerInfo,
    tableHeaders,
    ...tableData,
    [''],
    totalRow,
  ];

  // Create worksheet
  const worksheet = utils.aoa_to_sheet(sheetData);

  // Set column widths
  worksheet['!cols'] = [
    { wch: 12 },  // Numero
    { wch: 30 },  // Contribuente
    { wch: 6 },   // Rata
    { wch: 12 },  // Scadenza
    { wch: 12 },  // Importo
    { wch: 12 },  // Stato
    { wch: 12 },  // Rate Saltate
    { wch: 15 },  // Bucket
    { wch: 12 },  // Giorni Ritardo
  ];

  // Add worksheet to workbook
  utils.book_append_sheet(workbook, worksheet, 'Scadenze');

  // Generate filename
  const dateStr = format(new Date(), 'yyyy-MM-dd');
  const bucketSlug = (filters.bucket ?? 'all').toString().replace(/\s+/g, '-').toLowerCase();
  const filename = `scadenze-${filters.payFilter || 'all'}-${bucketSlug}-${dateStr}.xlsx`;

  // Save file
  writeFile(workbook, filename);
}
