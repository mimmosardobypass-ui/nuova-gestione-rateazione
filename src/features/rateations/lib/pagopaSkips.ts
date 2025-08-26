import type { InstallmentUI } from '@/features/rateations/types';

export const DEFAULT_MAX_PAGOPA_SKIPS = 8;

// Normalizza una data alle 00:00 locali
export function toMidnight(d: Date | string): Date {
  // Se stringa tipo 'YYYY-MM-DD', parse in locale per evitare drift
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y, m, dd] = d.split('-').map(Number);
    return new Date(y, (m ?? 1) - 1, dd ?? 1, 0, 0, 0, 0);
  }
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

// Conteggio rate non pagate con due_date < oggi @ 00:00
export function calcUnpaidOverdueToday(items: InstallmentUI[], todayMid: Date): number {
  return items.filter(it => !it?.is_paid && it?.due_date && toMidnight(it.due_date) < todayMid).length;
}

export type SkipRisk =
  | { level: 'limit'; cls: string; title: string }
  | { level: 'last';  cls: string; title: string }
  | { level: 'low';   cls: string; title: string }
  | null;

// warning graduato sui salti rimanenti
export function getSkipRisk(skipRemaining: number, max?: number): SkipRisk {
  if (skipRemaining <= 0) {
    return { level: 'limit', cls: 'text-red-600', title: 'Limite salti raggiunto — rischio decadenza' };
  }
  if (skipRemaining === 1) {
    return { level: 'last', cls: 'text-amber-600', title: 'Ultimo salto disponibile' };
  }
  if (skipRemaining === 2) {
    return { level: 'low', cls: 'text-yellow-600', title: 'Attenzione: 2 salti residui' };
  }
  return null;
}

// Calcolo coerente per i salti da usare nei componenti
export function computeSkips(row: {
  unpaid_overdue_today?: number;
  max_skips_effective?: number;
  skip_remaining?: number;
}) {
  const max = Number(row.max_skips_effective ?? DEFAULT_MAX_PAGOPA_SKIPS);
  const overdue = Number(row.unpaid_overdue_today ?? 0);
  const remaining = (typeof row.skip_remaining === 'number')
    ? Number(row.skip_remaining)
    : Math.max(0, max - overdue);
  return { remaining, max, overdue };
}