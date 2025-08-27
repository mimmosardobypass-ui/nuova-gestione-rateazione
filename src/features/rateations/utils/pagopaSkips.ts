// Unica fonte di verità per calcolo "non pagate ad oggi" e salti PagoPA

export const MAX_PAGOPA_SKIPS = 8 as const;

export type SkipRisk = 'limit' | 'last' | 'low' | null;

export type InstallmentLite = {
  is_paid: any;
  due_date?: string | Date | null;
};

// Mezzanotte locale sicura
export function toMidnightLocal(d: Date | string): Date {
  if (d instanceof Date) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d));
  if (m) {
    const [, y, mo, da] = m;
    return new Date(Number(y), Number(mo) - 1, Number(da), 0, 0, 0, 0);
  }
  const dd = new Date(d as any);
  return new Date(dd.getFullYear(), dd.getMonth(), dd.getDate(), 0, 0, 0, 0);
}

// Coercizione robusta del paid
function isPaid(v: any): boolean {
  return v === true || v === 1 || v === '1' || v === 'true' || v === 't' || v === 'T';
}

function isUnpaid(inst: InstallmentLite): boolean {
  return !isPaid(inst.is_paid);
}

function isOverdue(inst: InstallmentLite, todayMid: Date): boolean {
  if (!inst?.due_date) return false;
  return toMidnightLocal(inst.due_date) < todayMid;
}

function isDueToday(inst: InstallmentLite, todayMid: Date): boolean {
  if (!inst?.due_date) return false;
  return toMidnightLocal(inst.due_date).getTime() === todayMid.getTime();
}

export function calcPagopaKpis(
  items: InstallmentLite[],
  maxSkips: number = MAX_PAGOPA_SKIPS,
  today: Date = new Date()
) {
  const todayMid = toMidnightLocal(today);
  const unpaidOverdueToday = items.filter(i => isUnpaid(i) && isOverdue(i, todayMid)).length;
  const unpaidDueToday     = items.filter(i => isUnpaid(i) && isDueToday(i, todayMid)).length;
  const skipRemaining      = Math.max(0, maxSkips - unpaidOverdueToday);

  return { maxSkips, unpaidOverdueToday, unpaidDueToday, skipRemaining };
}

// Mappa rischio "legacy"
export function getSkipRisk(remaining: number) {
  if (remaining <= 0) return { level: 'limit', cls: 'text-red-600', title: 'Limite salti raggiunto — rischio decadenza' };
  if (remaining === 1) return { level: 'last',  cls: 'text-amber-600', title: 'Ultimo salto disponibile' };
  if (remaining === 2) return { level: 'low',   cls: 'text-yellow-600', title: 'Attenzione: 2 salti residui' };
  return null;
}

// Compat (alcuni componenti la chiamano così)
export function getLegacySkipRisk(remaining: number) {
  return getSkipRisk(remaining);
}

export { toMidnightLocal as toMidnight };