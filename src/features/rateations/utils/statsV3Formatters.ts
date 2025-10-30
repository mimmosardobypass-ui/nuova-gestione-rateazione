import { format } from "date-fns";
import { it } from "date-fns/locale";

export function formatCentsToEur(cents: number): number {
  return cents / 100;
}

export function formatEuroFromCents(cents: number): string {
  const eur = formatCentsToEur(cents);
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(eur);
}

export function formatMonth(monthStr: string): string {
  try {
    const date = new Date(monthStr);
    return format(date, "MMM yyyy", { locale: it });
  } catch {
    return monthStr;
  }
}

export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    F24: "F24",
    PAGOPA: "PagoPA",
    RIAMMISSIONE_QUATER: "Riammissione Quater",
    ALTRO: "Altro",
  };
  return labels[type] || type;
}

export function formatStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    attiva: "Attiva",
    completata: "Completata",
    interrotta: "Interrotta",
    decaduta: "Decaduta",
    estinta: "Estinta",
  };
  return labels[status] || status;
}

export function getTypeColor(type: string): string {
  const colors: Record<string, string> = {
    'F24': '#e03131',
    'PAGOPA': '#2f6ee5',
    'PagoPa': '#2f6ee5',
    'ROTTAMAZIONE_QUATER': '#2b8a3e',
    'Rottamazione Quater': '#2b8a3e',
    'RIAMMISSIONE_QUATER': '#0ca678',
    'Riammissione Quater': '#0ca678',
    'ALTRO': '#868e96',
    'Altro': '#868e96',
  };
  return colors[type] || '#868e96';
}

export function formatCurrencyCompact(cents: number): string {
  const eur = formatCentsToEur(cents);
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(eur);
}

export function formatMonthName(monthNum: number): string {
  const months = ["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"];
  return months[monthNum - 1] || "";
}
