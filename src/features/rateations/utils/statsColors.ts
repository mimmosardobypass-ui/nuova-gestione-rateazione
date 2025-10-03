/**
 * Color palette for Statistics Dashboard
 */

export const TYPE_COLORS: Record<string, string> = {
  'F24': '#e03131',
  'PagoPA': '#2f6ee5',
  'Rottamazione Quater': '#2b8a3e',
  'Riam. Quater': '#0ca678',
  'Altro': '#868e96',
};

export const STATUS_COLORS: Record<string, string> = {
  'attiva': '#228be6',
  'INTERROTTA': '#f08c00',
  'completata': '#868e96',
  'decaduta': '#fa5252',
};

export const CASHFLOW_COLORS = {
  paid: '#2b8a3e',
  due: '#e03131',
};

export function getTypeColor(typeLabel: string): string {
  return TYPE_COLORS[typeLabel] || TYPE_COLORS['Altro'];
}

export function getStatusColor(status: string): string {
  return STATUS_COLORS[status] || '#868e96';
}
