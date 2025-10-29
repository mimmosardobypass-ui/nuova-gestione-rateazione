import * as XLSX from "xlsx";
import { formatEuroFromCents } from "@/lib/formatters";
import type { MatrixByTypeData, MatrixByTypeFilters } from "../types/matrix-by-type";

const MONTHS = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

const TYPE_LABELS: Record<string, string> = {
  F24: "F24",
  PAGOPA: "PagoPA",
  ROTTAMAZIONE_QUATER: "Rottamazione Quater",
  RIAMMISSIONE_QUATER: "Riammissione Quater",
};

export function exportMatrixToExcel(
  data: MatrixByTypeData,
  filters: MatrixByTypeFilters,
  typeFilter: string[]
) {
  const workbook = XLSX.utils.book_new();

  // Sheet 1: Matrice Mensile
  const matrixSheet = createMatrixSheet(data, filters, typeFilter);
  XLSX.utils.book_append_sheet(workbook, matrixSheet, "Matrice Mensile");

  // Sheet 2: KPI Summary
  const kpiSheet = createKPISheet(data, filters);
  XLSX.utils.book_append_sheet(workbook, kpiSheet, "KPI");

  // Generate filename
  const timestamp = new Date().toISOString().split('T')[0];
  const yearLabel = filters.yearFilter || 'Tutti';
  const filename = `Scadenze_Matrix_${yearLabel}_${timestamp}.xlsx`;

  // Download
  XLSX.writeFile(workbook, filename);
}

function createMatrixSheet(data: MatrixByTypeData, filters: MatrixByTypeFilters, typeFilter: string[]) {
  const rows: any[] = [];

  // Header row with filters
  rows.push([`Statistica Scadenze - Anno ${filters.yearFilter || 'Tutti gli anni'}`]);
  rows.push([`Filtro Pagamento: ${getPayFilterLabel(filters.payFilter)}`]);
  rows.push([`Tipologie: ${typeFilter.map(t => TYPE_LABELS[t] || t).join(', ')}`]);
  rows.push([]); // Empty row

  // Data for each year
  const years = Object.keys(data).map(Number).sort();
  
  for (const year of years) {
    const yearData = data[year];
    
    // Header row
    const headerRow = ['Tipologia', ...MONTHS.map(m => `${m} ${year}`), 'TOTALE ANNO'];
    rows.push(headerRow);

    // Type rows
    for (const type of typeFilter) {
      const typeRow = [TYPE_LABELS[type] || type];
      let yearTotal = 0;

      for (let month = 1; month <= 12; month++) {
        const value = yearData[type]?.[month] || 0;
        yearTotal += value;
        typeRow.push(formatEuroFromCents(value));
      }

      typeRow.push(formatEuroFromCents(yearTotal));
      rows.push(typeRow);
    }

    // Total row
    const totalRow = ['TOTALE'];
    let grandTotal = 0;
    
    for (let month = 1; month <= 12; month++) {
      const value = yearData.totals?.[month] || 0;
      grandTotal += value;
      totalRow.push(formatEuroFromCents(value));
    }
    
    totalRow.push(formatEuroFromCents(grandTotal));
    rows.push(totalRow);

    // Progressive row
    const progressiveRow = ['PROGRESSIVO'];
    
    for (let month = 1; month <= 12; month++) {
      const value = yearData.progressive?.[month] || 0;
      progressiveRow.push(formatEuroFromCents(value));
    }
    
    progressiveRow.push(formatEuroFromCents(yearData.progressive?.[12] || 0));
    rows.push(progressiveRow);

    rows.push([]); // Empty row between years
  }

  return XLSX.utils.aoa_to_sheet(rows);
}

function createKPISheet(data: MatrixByTypeData, filters: MatrixByTypeFilters) {
  const rows: any[] = [];

  rows.push(['KPI Riepilogo']);
  rows.push([]);

  const years = Object.keys(data).map(Number).sort();

  for (const year of years) {
    const yearData = data[year];
    
    if (!yearData || !yearData.totals) continue;

    const monthlyTotals = Object.values(yearData.totals) as number[];
    const totalYear = monthlyTotals.reduce((sum, val) => sum + val, 0);
    const activeMonths = monthlyTotals.filter(v => v > 0).length;
    const monthlyAverage = activeMonths > 0 ? totalYear / activeMonths : 0;
    const maxPeak = Math.max(...monthlyTotals, 0);

    rows.push([`Anno ${year}`]);
    rows.push(['Totale Anno', formatEuroFromCents(totalYear)]);
    rows.push(['Media Mensile', formatEuroFromCents(monthlyAverage)]);
    rows.push(['Picco Massimo', formatEuroFromCents(maxPeak)]);
    rows.push(['Mesi Attivi', `${activeMonths} / 12`]);
    rows.push([]);
  }

  return XLSX.utils.aoa_to_sheet(rows);
}

function getPayFilterLabel(filter: string): string {
  switch (filter) {
    case 'unpaid': return 'Solo rate NON pagate';
    case 'paid': return 'Solo rate PAGATE';
    case 'all': return 'Tutte (pagate + non pagate)';
    default: return filter;
  }
}

export function printMatrix() {
  window.print();
}
