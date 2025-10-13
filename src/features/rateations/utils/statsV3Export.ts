import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { StatsV3Data, StatsV3Filters } from "../hooks/useStatsV3";
import { formatEuroFromCents, formatTypeLabel, formatStatusLabel, formatPercentage, formatMonth } from "./statsV3Formatters";

export function exportToExcelV3(data: StatsV3Data, filters: StatsV3Filters): void {
  const workbook = XLSX.utils.book_new();

  // Sheet 1: KPIs
  const kpisData = [
    ["Metrica", "Valore"],
    ["Totale Dovuto", formatEuroFromCents(data.kpis.total_due_cents)],
    ["Totale Pagato", formatEuroFromCents(data.kpis.total_paid_cents)],
    ["Totale Residuo", formatEuroFromCents(data.kpis.total_residual_cents)],
    ["In Ritardo", formatEuroFromCents(data.kpis.total_overdue_cents)],
    ["Decaduto", formatEuroFromCents(data.kpis.total_decayed_cents)],
    ["Risparmio RQ", formatEuroFromCents(data.kpis.rq_saving_cents)],
    ["Completamento", formatPercentage(data.kpis.completion_percent)],
  ];
  const kpisSheet = XLSX.utils.aoa_to_sheet(kpisData);
  XLSX.utils.book_append_sheet(workbook, kpisSheet, "KPI");

  // Sheet 2: Per Tipologia
  const byTypeData = [
    ["Tipologia", "Conteggio", "Totale", "Pagato", "Residuo", "In Ritardo", "% Completamento"],
    ...data.by_type.map((t) => [
      formatTypeLabel(t.type),
      t.count,
      formatEuroFromCents(t.total_cents),
      formatEuroFromCents(t.paid_cents),
      formatEuroFromCents(t.residual_cents),
      formatEuroFromCents(t.overdue_cents),
      formatPercentage(t.avg_completion_percent),
    ]),
  ];
  const byTypeSheet = XLSX.utils.aoa_to_sheet(byTypeData);
  XLSX.utils.book_append_sheet(workbook, byTypeSheet, "Per Tipologia");

  // Sheet 3: Per Stato
  const byStatusData = [
    ["Stato", "Conteggio", "Totale"],
    ...data.by_status.map((s) => [
      formatStatusLabel(s.status),
      s.count,
      formatEuroFromCents(s.total_cents),
    ]),
  ];
  const byStatusSheet = XLSX.utils.aoa_to_sheet(byStatusData);
  XLSX.utils.book_append_sheet(workbook, byStatusSheet, "Per Stato");

  // Sheet 4: Serie Mensile
  const seriesData = [
    ["Mese", "Totale", "Pagato", "Residuo"],
    ...data.series.map((s) => [
      formatMonth(s.month),
      formatEuroFromCents(s.total_cents),
      formatEuroFromCents(s.paid_cents),
      formatEuroFromCents(s.residual_cents),
    ]),
  ];
  const seriesSheet = XLSX.utils.aoa_to_sheet(seriesData);
  XLSX.utils.book_append_sheet(workbook, seriesSheet, "Serie Mensile");

  // Sheet 5: Dettaglio
  const detailsData = [
    ["Numero", "Tipo", "Stato", "Contribuente", "Totale", "Pagato", "Residuo", "Ritardo", "Rate Tot", "Rate Pag", "% Compl"],
    ...data.details.map((d) => [
      d.number,
      formatTypeLabel(d.type),
      formatStatusLabel(d.status),
      d.taxpayer_name || "N/A",
      formatEuroFromCents(d.total_cents),
      formatEuroFromCents(d.paid_cents),
      formatEuroFromCents(d.residual_cents),
      formatEuroFromCents(d.overdue_cents),
      d.installments_total,
      d.installments_paid,
      formatPercentage(d.completion_percent),
    ]),
  ];
  const detailsSheet = XLSX.utils.aoa_to_sheet(detailsData);
  XLSX.utils.book_append_sheet(workbook, detailsSheet, "Dettaglio");

  XLSX.writeFile(workbook, `statistiche_v3_${new Date().toISOString().split("T")[0]}.xlsx`);
}

export function exportToPDFV3(data: StatsV3Data, filters: StatsV3Filters): void {
  const doc = new jsPDF();

  // Title
  doc.setFontSize(18);
  doc.text("Statistiche Avanzate V3", 14, 20);

  doc.setFontSize(10);
  doc.text(`Generato il: ${new Date().toLocaleString("it-IT")}`, 14, 28);

  // KPIs Table
  doc.setFontSize(14);
  doc.text("KPI Principali", 14, 40);

  autoTable(doc, {
    startY: 45,
    head: [["Metrica", "Valore"]],
    body: [
      ["Totale Dovuto", formatEuroFromCents(data.kpis.total_due_cents)],
      ["Totale Pagato", formatEuroFromCents(data.kpis.total_paid_cents)],
      ["Totale Residuo", formatEuroFromCents(data.kpis.total_residual_cents)],
      ["In Ritardo", formatEuroFromCents(data.kpis.total_overdue_cents)],
      ["Decaduto", formatEuroFromCents(data.kpis.total_decayed_cents)],
      ["Risparmio RQ", formatEuroFromCents(data.kpis.rq_saving_cents)],
      ["Completamento", formatPercentage(data.kpis.completion_percent)],
    ],
  });

  // By Type Table
  const finalY1 = (doc as any).lastAutoTable.finalY || 90;
  doc.setFontSize(14);
  doc.text("Analisi per Tipologia", 14, finalY1 + 10);

  autoTable(doc, {
    startY: finalY1 + 15,
    head: [["Tipo", "N°", "Totale", "Pagato", "Residuo", "% Compl"]],
    body: data.by_type.map((t) => [
      formatTypeLabel(t.type),
      t.count,
      formatEuroFromCents(t.total_cents),
      formatEuroFromCents(t.paid_cents),
      formatEuroFromCents(t.residual_cents),
      formatPercentage(t.avg_completion_percent),
    ]),
  });

  // By Status Table
  const finalY2 = (doc as any).lastAutoTable.finalY || 140;
  
  if (finalY2 > 250) {
    doc.addPage();
    doc.setFontSize(14);
    doc.text("Analisi per Stato", 14, 20);
    autoTable(doc, {
      startY: 25,
      head: [["Stato", "Conteggio", "Totale"]],
      body: data.by_status.map((s) => [
        formatStatusLabel(s.status),
        s.count,
        formatEuroFromCents(s.total_cents),
      ]),
    });
  } else {
    doc.setFontSize(14);
    doc.text("Analisi per Stato", 14, finalY2 + 10);
    autoTable(doc, {
      startY: finalY2 + 15,
      head: [["Stato", "Conteggio", "Totale"]],
      body: data.by_status.map((s) => [
        formatStatusLabel(s.status),
        s.count,
        formatEuroFromCents(s.total_cents),
      ]),
    });
  }

  doc.save(`statistiche_v3_${new Date().toISOString().split("T")[0]}.pdf`);
}

export function printReport(): void {
  window.print();
}
