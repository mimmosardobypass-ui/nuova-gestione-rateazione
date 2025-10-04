/**
 * Export functions for Statistics Dashboard
 * Excel: 5 sheets (Per_tipologia, Per_stato, Per_contribuente, Cashflow_mensile, Risparmi_RQ)
 * PDF: Multi-page with KPIs, charts, tables
 */

import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { FilteredStats, StatsKPIs, StatsFilters, ResidualDetailRow } from '../types/stats';
import { formatEuroFromCents } from '@/lib/formatters';
import { formatMonth } from './statsFormatters';

const TYPE_ORDER = ['F24', 'PagoPA', 'Rottamazione Quater', 'Riam. Quater', 'Altro'];

export function exportToExcel(
  stats: FilteredStats,
  kpis: StatsKPIs,
  filters: StatsFilters
): void {
  const wb = XLSX.utils.book_new();

  // Header with filters
  const filterHeader = [
    ['Statistiche Rateazioni'],
    [`Periodo: ${filters.startDate} - ${filters.endDate}`],
    [`Tipologie: ${filters.typeLabels?.join(', ') || 'Tutte'}`],
    [`Stati: ${filters.statuses?.join(', ') || 'Tutti'}`],
    [`Contribuente: ${filters.taxpayerSearch || 'Tutti'}`],
    [],
  ];

  // Sheet 1: Per_tipologia
  const typeData = stats.by_type.map(row => ({
    Tipo: row.type_label,
    Conteggio: row.count,
    Totale: formatEuroFromCents(row.total_amount_cents),
    Pagato: formatEuroFromCents(row.paid_amount_cents),
    Residuo: formatEuroFromCents(row.residual_amount_cents),
    'In Ritardo': formatEuroFromCents(row.overdue_amount_cents),
  }));
  const wsType = XLSX.utils.aoa_to_sheet(filterHeader);
  XLSX.utils.sheet_add_json(wsType, typeData, { origin: -1 });
  XLSX.utils.book_append_sheet(wb, wsType, 'Per_tipologia');

  // Sheet 2: Per_stato
  const statusData = stats.by_status.map(row => ({
    Stato: row.status,
    Conteggio: row.count,
    Totale: formatEuroFromCents(row.total_amount_cents),
    Pagato: formatEuroFromCents(row.paid_amount_cents),
    Residuo: formatEuroFromCents(row.residual_amount_cents),
    'In Ritardo': formatEuroFromCents(row.overdue_amount_cents),
  }));
  const wsStatus = XLSX.utils.aoa_to_sheet(filterHeader);
  XLSX.utils.sheet_add_json(wsStatus, statusData, { origin: -1 });
  XLSX.utils.book_append_sheet(wb, wsStatus, 'Per_stato');

  // Sheet 3: Per_contribuente
  const taxpayerData = stats.by_taxpayer.slice(0, 50).map(row => ({
    Contribuente: row.taxpayer_name || 'Sconosciuto',
    Conteggio: row.count,
    Totale: formatEuroFromCents(row.total_amount_cents),
    Pagato: formatEuroFromCents(row.paid_amount_cents),
    Residuo: formatEuroFromCents(row.residual_amount_cents),
    'In Ritardo': formatEuroFromCents(row.overdue_amount_cents),
  }));
  const wsTaxpayer = XLSX.utils.aoa_to_sheet(filterHeader);
  XLSX.utils.sheet_add_json(wsTaxpayer, taxpayerData, { origin: -1 });
  XLSX.utils.book_append_sheet(wb, wsTaxpayer, 'Per_contribuente');

  // Sheet 4: Cashflow_mensile
  const cashflowData = stats.cashflow.map(row => ({
    Mese: formatMonth(row.month),
    Rate: row.installments_count,
    Dovuto: formatEuroFromCents(row.due_amount_cents),
    Pagato: formatEuroFromCents(row.paid_amount_cents),
    'Non Pagato': formatEuroFromCents(row.unpaid_amount_cents),
    'In Ritardo': formatEuroFromCents(row.overdue_amount_cents),
  }));
  const wsCashflow = XLSX.utils.aoa_to_sheet(filterHeader);
  XLSX.utils.sheet_add_json(wsCashflow, cashflowData, { origin: -1 });
  XLSX.utils.book_append_sheet(wb, wsCashflow, 'Cashflow_mensile');

  // Sheet 5: Risparmi_RQ
  const savingsData = [
    { KPI: 'Residuo Totale', Valore: kpis.residual_total.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €' },
    { KPI: 'Pagato Totale', Valore: kpis.paid_total.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €' },
    { KPI: 'In Ritardo', Valore: kpis.overdue_total.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €' },
    { KPI: 'Risparmio RQ', Valore: kpis.quater_saving.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €' },
  ];
  const wsSavings = XLSX.utils.aoa_to_sheet(filterHeader);
  XLSX.utils.sheet_add_json(wsSavings, savingsData, { origin: -1 });
  XLSX.utils.book_append_sheet(wb, wsSavings, 'Risparmi_RQ');

  XLSX.writeFile(wb, `statistiche_${new Date().toISOString().split('T')[0]}.xlsx`);
}

export function exportToPDF(
  stats: FilteredStats,
  kpis: StatsKPIs,
  filters: StatsFilters
): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPos = 20;

  // Header
  doc.setFontSize(16);
  doc.text('Statistiche Rateazioni', pageWidth / 2, yPos, { align: 'center' });
  yPos += 10;

  doc.setFontSize(10);
  doc.text(`Periodo: ${filters.startDate} - ${filters.endDate}`, 14, yPos);
  yPos += 6;
  doc.text(`Tipologie: ${filters.typeLabels?.join(', ') || 'Tutte'}`, 14, yPos);
  yPos += 6;
  doc.text(`Stati: ${filters.statuses?.join(', ') || 'Tutti'}`, 14, yPos);
  yPos += 10;

  // KPIs
  doc.setFontSize(12);
  doc.text('KPI', 14, yPos);
  yPos += 6;

  const kpiData = [
    ['Residuo Totale', kpis.residual_total.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'],
    ['Pagato Totale', kpis.paid_total.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'],
    ['In Ritardo', kpis.overdue_total.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'],
    ['Risparmio RQ', kpis.quater_saving.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'],
  ];

  autoTable(doc, {
    startY: yPos,
    head: [['KPI', 'Valore']],
    body: kpiData,
    theme: 'grid',
  });

  yPos = (doc as any).lastAutoTable.finalY + 10;

  // Per Tipologia
  if (yPos + 40 > pageHeight) {
    doc.addPage();
    yPos = 20;
  }

  doc.setFontSize(12);
  doc.text('Per Tipologia', 14, yPos);
  yPos += 6;

  autoTable(doc, {
    startY: yPos,
    head: [['Tipo', 'Conteggio', 'Totale', 'Pagato', 'Residuo', 'In Ritardo']],
    body: stats.by_type.map(row => [
      row.type_label,
      row.count,
      formatEuroFromCents(row.total_amount_cents),
      formatEuroFromCents(row.paid_amount_cents),
      formatEuroFromCents(row.residual_amount_cents),
      formatEuroFromCents(row.overdue_amount_cents),
    ]),
    theme: 'grid',
  });

  yPos = (doc as any).lastAutoTable.finalY + 10;

  // Per Stato
  if (yPos + 40 > pageHeight) {
    doc.addPage();
    yPos = 20;
  }

  doc.setFontSize(12);
  doc.text('Per Stato', 14, yPos);
  yPos += 6;

  autoTable(doc, {
    startY: yPos,
    head: [['Stato', 'Conteggio', 'Totale', 'Pagato', 'Residuo', 'In Ritardo']],
    body: stats.by_status.map(row => [
      row.status,
      row.count,
      formatEuroFromCents(row.total_amount_cents),
      formatEuroFromCents(row.paid_amount_cents),
      formatEuroFromCents(row.residual_amount_cents),
      formatEuroFromCents(row.overdue_amount_cents),
    ]),
    theme: 'grid',
  });

  yPos = (doc as any).lastAutoTable.finalY + 10;

  // Top Contribuenti
  doc.addPage();
  yPos = 20;

  doc.setFontSize(12);
  doc.text('Top Contribuenti (max 50)', 14, yPos);
  yPos += 6;

  autoTable(doc, {
    startY: yPos,
    head: [['Contribuente', 'Conteggio', 'Totale', 'Pagato', 'Residuo', 'In Ritardo']],
    body: stats.by_taxpayer.slice(0, 50).map(row => [
      row.taxpayer_name || 'Sconosciuto',
      row.count,
      formatEuroFromCents(row.total_amount_cents),
      formatEuroFromCents(row.paid_amount_cents),
      formatEuroFromCents(row.residual_amount_cents),
      formatEuroFromCents(row.overdue_amount_cents),
    ]),
    theme: 'grid',
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(
      `Generato il ${new Date().toLocaleString('it-IT')} - Pagina ${i} di ${pageCount}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }

  doc.save(`statistiche_${new Date().toISOString().split('T')[0]}.pdf`);
}

/**
 * Export Residual Detail to Excel
 */
export function exportResidualToExcel(
  rows: ResidualDetailRow[],
  filters: StatsFilters,
  groupByType: boolean
): void {
  const wb = XLSX.utils.book_new();

  // Header with filters
  const filterHeader = [
    ['Dettaglio Residui'],
    [`Periodo: ${filters.startDate} - ${filters.endDate}`],
    [`Tipologie: ${filters.typeLabels?.join(', ') || 'Tutte'}`],
    [`Stati: ${filters.statuses?.join(', ') || 'Tutti'}`],
    [`Contribuente: ${filters.taxpayerSearch || 'Tutti'}`],
    [],
  ];

  const total = rows.reduce((sum, r) => sum + (r.residual_amount_cents || 0), 0);

  if (!groupByType) {
    // Ungrouped layout
    const data = rows.map(row => ({
      Numero: row.number,
      Contribuente: row.taxpayer_name || 'Sconosciuto',
      Tipo: row.type_label,
      Stato: row.status,
      'Creato il': new Date(row.created_at).toLocaleDateString('it-IT'),
      Residuo: formatEuroFromCents(row.residual_amount_cents),
    }));

    const ws = XLSX.utils.aoa_to_sheet(filterHeader);
    XLSX.utils.sheet_add_json(ws, data, { origin: -1 });
    
    // Add total row
    const totalRow = [['', '', '', '', 'TOTALE', formatEuroFromCents(total)]];
    XLSX.utils.sheet_add_aoa(ws, totalRow, { origin: -1 });
    
    XLSX.utils.book_append_sheet(wb, ws, 'Dettaglio_Residui');
  } else {
    // Grouped layout with subtotals
    const groups = rows.reduce<Record<string, ResidualDetailRow[]>>((acc, r) => {
      (acc[r.type_label] ||= []).push(r);
      return acc;
    }, {});

    const sortedTypes = TYPE_ORDER.filter(t => groups[t]);
    const ws = XLSX.utils.aoa_to_sheet(filterHeader);
    let currentRow = filterHeader.length;

    for (const type of sortedTypes) {
      const list = groups[type];
      if (!list?.length) continue;

      // Type header
      XLSX.utils.sheet_add_aoa(ws, [[type]], { origin: `A${currentRow + 1}` });
      currentRow++;

      // Data rows
      const data = list.map(row => ({
        Numero: row.number,
        Contribuente: row.taxpayer_name || 'Sconosciuto',
        Stato: row.status,
        'Creato il': new Date(row.created_at).toLocaleDateString('it-IT'),
        Residuo: formatEuroFromCents(row.residual_amount_cents),
      }));
      
      XLSX.utils.sheet_add_json(ws, data, { origin: `A${currentRow + 1}`, skipHeader: currentRow > filterHeader.length + 1 });
      currentRow += data.length;

      // Subtotal row
      const subTotal = list.reduce((sum, r) => sum + (r.residual_amount_cents || 0), 0);
      XLSX.utils.sheet_add_aoa(ws, [[`Sub-totale ${type}`, '', '', '', formatEuroFromCents(subTotal)]], { origin: `A${currentRow + 1}` });
      currentRow += 2; // Extra space after subtotal
    }

    // Total row
    XLSX.utils.sheet_add_aoa(ws, [['', '', '', 'TOTALE GENERALE', formatEuroFromCents(total)]], { origin: `A${currentRow + 1}` });
    
    XLSX.utils.book_append_sheet(wb, ws, 'Dettaglio_Residui');
  }

  XLSX.writeFile(wb, `dettaglio_residui_${new Date().toISOString().split('T')[0]}.xlsx`);
}

/**
 * Export Residual Detail to PDF
 */
export function exportResidualToPDF(
  rows: ResidualDetailRow[],
  filters: StatsFilters,
  groupByType: boolean
): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPos = 20;

  // Header
  doc.setFontSize(16);
  doc.text('Dettaglio Residui', pageWidth / 2, yPos, { align: 'center' });
  yPos += 10;

  doc.setFontSize(10);
  doc.text(`Periodo: ${filters.startDate} - ${filters.endDate}`, 14, yPos);
  yPos += 6;
  doc.text(`Tipologie: ${filters.typeLabels?.join(', ') || 'Tutte'}`, 14, yPos);
  yPos += 6;
  doc.text(`Stati: ${filters.statuses?.join(', ') || 'Tutti'}`, 14, yPos);
  yPos += 10;

  const total = rows.reduce((sum, r) => sum + (r.residual_amount_cents || 0), 0);

  if (!groupByType) {
    // Ungrouped layout
    autoTable(doc, {
      startY: yPos,
      head: [['Numero', 'Contribuente', 'Tipo', 'Stato', 'Creato il', 'Residuo']],
      body: rows.map(row => [
        row.number,
        row.taxpayer_name || 'Sconosciuto',
        row.type_label,
        row.status,
        new Date(row.created_at).toLocaleDateString('it-IT'),
        formatEuroFromCents(row.residual_amount_cents),
      ]),
      foot: [['', '', '', '', 'TOTALE', formatEuroFromCents(total)]],
      theme: 'grid',
    });
  } else {
    // Grouped layout with subtotals
    const groups = rows.reduce<Record<string, ResidualDetailRow[]>>((acc, r) => {
      (acc[r.type_label] ||= []).push(r);
      return acc;
    }, {});

    const sortedTypes = TYPE_ORDER.filter(t => groups[t]);

    for (const type of sortedTypes) {
      const list = groups[type];
      if (!list?.length) continue;

      if (yPos + 50 > pageHeight) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(12);
      doc.text(type, 14, yPos);
      yPos += 6;

      const subTotal = list.reduce((sum, r) => sum + (r.residual_amount_cents || 0), 0);

      autoTable(doc, {
        startY: yPos,
        head: [['Numero', 'Contribuente', 'Stato', 'Creato il', 'Residuo']],
        body: list.map(row => [
          row.number,
          row.taxpayer_name || 'Sconosciuto',
          row.status,
          new Date(row.created_at).toLocaleDateString('it-IT'),
          formatEuroFromCents(row.residual_amount_cents),
        ]),
        foot: [[`Sub-totale ${type}`, '', '', '', formatEuroFromCents(subTotal)]],
        theme: 'grid',
      });

      yPos = (doc as any).lastAutoTable.finalY + 10;
    }

    // Total general
    doc.setFontSize(12);
    doc.text(`TOTALE GENERALE: ${formatEuroFromCents(total)}`, pageWidth - 14, yPos, { align: 'right' });
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(
      `Generato il ${new Date().toLocaleString('it-IT')} - Pagina ${i} di ${pageCount}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }

  doc.save(`dettaglio_residui_${new Date().toISOString().split('T')[0]}.pdf`);
}
