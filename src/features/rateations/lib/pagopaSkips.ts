import type { InstallmentUI } from '@/features/rateations/types';

export const DEFAULT_MAX_PAGOPA_SKIPS = 8;

// Normalizza una data alle 00:00 locali (timezone-safe per YYYY-MM-DD)
export function toMidnightLocal(d: Date | string): Date {
  // Se stringa tipo 'YYYY-MM-DD', parse come data locale per evitare drift timezone
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y, m, dd] = d.split('-').map(Number);
    return new Date(y, (m ?? 1) - 1, dd ?? 1, 0, 0, 0, 0);
  }
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

// Backward compatibility
export const toMidnight = toMidnightLocal;

// Conteggio rate non pagate con due_date < oggi @ 00:00 (timezone-safe)
export function calcUnpaidOverdueToday(items: InstallmentUI[], todayMid: Date): number {
  return items.filter(it => !it?.is_paid && it?.due_date && toMidnightLocal(it.due_date) < todayMid).length;
}

export type SkipRisk =
  | { level: 'limit'; cls: string; title: string }
  | { level: 'last';  cls: string; title: string }
  | { level: 'low';   cls: string; title: string }
  | null;

// Calcolo coerente per la cella della tabella
export function computeSkips(row: {
  unpaid_overdue_today?: number;
  max_skips_effective?: number;
  skip_remaining?: number;
}) {
  const max = Number(row.max_skips_effective ?? 8);
  const overdue = Number(row.unpaid_overdue_today ?? 0);
  const remaining = (typeof row.skip_remaining === 'number')
    ? Number(row.skip_remaining)
    : Math.max(0, max - overdue);
  return { remaining, max, overdue };
}

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
