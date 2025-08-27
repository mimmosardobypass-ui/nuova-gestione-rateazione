// Unica fonte di verità per calcolo "non pagate ad oggi" e salti PagoPA

export const MAX_PAGOPA_SKIPS = 8 as const;

export type SkipRisk = 'limit' | 'last' | 'low' | null;

export type InstallmentLite = {
  is_paid: boolean;
  due_date: string | Date | null;
};

export function toMidnightLocal(d: Date | string): Date {
  // Se è già un Date, usa costruttore locale per evitare timezone drift
  if (d instanceof Date) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  }
  // Se stringa tipo 'YYYY-MM-DD', parse come data locale
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (m) {
    const [, y, mo, da] = m;
    return new Date(Number(y), Number(mo) - 1, Number(da), 0, 0, 0, 0);
  }
  // Fallback: parse e poi converti a mezzanotte locale
  const dd = new Date(d);
  return new Date(dd.getFullYear(), dd.getMonth(), dd.getDate(), 0, 0, 0, 0);
}

export function isUnpaidOverdue(inst: InstallmentLite, todayMid: Date): boolean {
  if (!inst || inst.is_paid || !inst.due_date) return false;
  return toMidnightLocal(inst.due_date) < todayMid;
}

/** Conteggio rate scadute e non pagate (ad oggi, non-consecutive) */
export function countUnpaidOverdueToday(
  items: InstallmentLite[],
  todayMid: Date = toMidnightLocal(new Date())
): number {
  return items.filter((it) => isUnpaidOverdue(it, todayMid)).length;
}

/** Rischio graduato sui salti residui */
export function getSkipRisk(skipRemaining: number): SkipRisk {
  if (skipRemaining <= 0) return 'limit'; // rosso
  if (skipRemaining === 1) return 'last'; // ambra
  if (skipRemaining === 2) return 'low';  // giallo
  return null;
}

/** KPI PagoPA calcolati localmente e in modo timezone-safe */
export function calcPagopaKpis(
  items: InstallmentLite[],
  maxSkips: number = MAX_PAGOPA_SKIPS,
  todayMid: Date = toMidnightLocal(new Date())
): {
  unpaidOverdueToday: number;
  skipRemaining: number;
  maxSkips: number;
  risk: SkipRisk;
} {
  const unpaidOverdueToday = countUnpaidOverdueToday(items, todayMid);
  const skipRemaining = Math.max(0, maxSkips - unpaidOverdueToday);
  return {
    unpaidOverdueToday,
    skipRemaining,
    maxSkips,
    risk: getSkipRisk(skipRemaining),
  };
}

// Backward compatibility helpers
export { toMidnightLocal as toMidnight };

// Legacy risk object format helper
export function getLegacySkipRisk(skipRemaining: number): { level: string; cls: string; title: string } | null {
  const risk = getSkipRisk(skipRemaining);
  if (!risk) return null;
  
  switch (risk) {
    case 'limit':
      return { level: 'limit', cls: 'text-red-600', title: 'Limite salti raggiunto — rischio decadenza' };
    case 'last':
      return { level: 'last', cls: 'text-amber-600', title: 'Ultimo salto disponibile' };
    case 'low':
      return { level: 'low', cls: 'text-yellow-600', title: 'Attenzione: 2 salti residui' };
    default:
      return null;
  }
}