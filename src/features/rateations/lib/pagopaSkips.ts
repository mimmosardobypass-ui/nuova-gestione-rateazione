// src/features/rateations/lib/pagopaSkips.ts
export type SkipRisk =
  | { level: 'limit'; cls: string; title: string }
  | { level: 'last'; cls: string; title: string }
  | { level: 'low'; cls: string; title: string }
  | null;

/**
 * Determina la severità del rischio in base ai salti residui.
 * - <= 0  : limite raggiunto (rosso)
 * - == 1  : ultimo salto (ambra)
 * - == 2  : pre-allerta (giallo)
 * - altrimenti: nessun avviso
 */
export function getSkipRisk(skipRemaining: number | undefined | null): SkipRisk {
  const skip = Number.isFinite(skipRemaining as number)
    ? (skipRemaining as number)
    : 8; // default di sicurezza

  if (skip <= 0) {
    return {
      level: 'limit',
      cls: 'text-red-600',
      title: 'Limite salti raggiunto — rischio decadenza',
    };
  }
  if (skip === 1) {
    return {
      level: 'last',
      cls: 'text-amber-600',
      title: 'Ultimo salto disponibile',
    };
  }
  if (skip === 2) {
    return {
      level: 'low',
      cls: 'text-yellow-600',
      title: 'Attenzione: 2 salti residui',
    };
  }
  return null;
}