import * as XLSX from 'xlsx';
import type {
  ResidualEvolutionData,
  ResidualEvolutionFilters,
  KPIData,
} from '@/features/rateations/types/residual-evolution';
import { formatEuroFromCents } from '@/lib/formatters';
import { MONTH_NAMES } from '@/features/rateations/types/residual-evolution';

/**
 * Export Residual Evolution data to Excel (2 sheets)
 */
export function exportResidualEvolutionToExcel(
  data: ResidualEvolutionData,
  kpis: KPIData,
  filters: ResidualEvolutionFilters
): void {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Monthly Matrix
  const matrixSheet = createMatrixSheet(data, filters);
  XLSX.utils.book_append_sheet(wb, matrixSheet, 'Matrice Mensile');

  // Sheet 2: KPI Summary
  const kpiSheet = createKPISheet(data, kpis);
  XLSX.utils.book_append_sheet(wb, kpiSheet, 'KPI');

  // Download
  const fileName = `Evoluzione_Debito_Residuo_${filters.yearFrom}-${filters.yearTo}_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

function createMatrixSheet(
  data: ResidualEvolutionData,
  filters: ResidualEvolutionFilters
): XLSX.WorkSheet {
  const years = Array.from(
    { length: filters.yearTo - filters.yearFrom + 1 },
    (_, i) => filters.yearFrom + i
  );

  const rows: any[] = [];

  // Header: Filters
  rows.push(['Evoluzione Debito Residuo']);
  rows.push(['Periodo:', `${filters.yearFrom} - ${filters.yearTo}`]);
  rows.push(['Filtro Pagamento:', filters.payFilter === 'unpaid' ? 'Non Pagate' : filters.payFilter === 'paid' ? 'Pagate' : 'Tutte']);
  rows.push(['Tipi Selezionati:', filters.selectedTypes.join(', ')]);
  rows.push([]); // Empty row

  // Table Header
  const headerRow = ['Mese', ...years];
  rows.push(headerRow);

  // For each year
  years.forEach((year) => {
    rows.push([`ANNO ${year}`, ...Array(years.length).fill('')]);

    // 12 months
    for (let month = 1; month <= 12; month++) {
      const monthName = MONTH_NAMES[month - 1];
      const monthData = data[year]?.[month];

      // Month row
      rows.push([monthName, ...years.map((y) => (y === year ? '' : ''))]);

      // Totale Mensile row
      const totalMonthlyRow = ['  Totale Mensile'];
      years.forEach((y) => {
        if (y === year) {
          totalMonthlyRow.push(formatEuroFromCents(monthData?.total || 0));
        } else {
          totalMonthlyRow.push('-');
        }
      });
      rows.push(totalMonthlyRow);

      // Scad. Progressive row
      const progressiveRow = ['  Scad. Progressive'];
      years.forEach((y) => {
        if (y === year) {
          progressiveRow.push(formatEuroFromCents(data[year]?.progressive[month] || 0));
        } else {
          progressiveRow.push('-');
        }
      });
      rows.push(progressiveRow);
    }

    // TOTALE ANNO row
    const totalYearRow = ['TOTALE ANNO'];
    years.forEach((y) => {
      if (y === year) {
        totalYearRow.push(formatEuroFromCents(data[year]?.totalYear || 0));
      } else {
        totalYearRow.push('-');
      }
    });
    rows.push(totalYearRow);

    // MEDIA MENSILE row
    const averageMonthRow = ['MEDIA MENSILE'];
    years.forEach((y) => {
      if (y === year) {
        averageMonthRow.push(formatEuroFromCents(data[year]?.averageMonth || 0));
      } else {
        averageMonthRow.push('-');
      }
    });
    rows.push(averageMonthRow);

    rows.push([]); // Empty row between years
  });

  return XLSX.utils.aoa_to_sheet(rows);
}

function createKPISheet(data: ResidualEvolutionData, kpis: KPIData): XLSX.WorkSheet {
  const rows: any[] = [];

  rows.push(['KPI Riepilogative']);
  rows.push([]);

  // Header
  rows.push(['Anno', 'Totale Anno', 'Media Mensile', 'Picco Mese', 'Mesi Attivi']);

  // Per year
  Object.keys(data)
    .map(Number)
    .sort()
    .forEach((year) => {
      const yearData = data[year];
      const yearPeak = Math.max(...Object.keys(yearData).filter(k => !isNaN(Number(k))).map(m => yearData[Number(m)].total));
      const yearActiveMonths = Object.keys(yearData).filter(k => !isNaN(Number(k))).filter(m => yearData[Number(m)].total > 0).length;

      rows.push([
        year.toString(),
        formatEuroFromCents(yearData.totalYear),
        formatEuroFromCents(yearData.averageMonth),
        formatEuroFromCents(yearPeak),
        yearActiveMonths.toString(),
      ]);
    });

  rows.push([]);

  // Overall KPI
  rows.push(['TOTALE PERIODO', formatEuroFromCents(kpis.totalPeriod), '', '', '']);
  rows.push(['MEDIA MENSILE PERIODO', formatEuroFromCents(kpis.averageMonth), '', '', '']);
  rows.push(['PICCO MENSILE', formatEuroFromCents(kpis.peakMonth), '', '', '']);
  rows.push(['MESI ATTIVI', kpis.activeMonths.toString(), '', '', '']);

  return XLSX.utils.aoa_to_sheet(rows);
}

/**
 * Print function (optimized for print)
 */
export function printResidualEvolution(): void {
  window.print();
}
