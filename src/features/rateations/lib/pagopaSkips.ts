// src/features/rateations/lib/pagopaSkips.ts
import { MAX_PAGOPA_SKIPS } from '@/features/rateations/constants/pagopa';

export type SkipRisk =
  | { level: 'limit'; cls: string; title: string }
  | { level: 'last';  cls: string; title: string }
  | { level: 'low';   cls: string; title: string }
  | null;

/**
 * Severità:
 *  - <= 0 : limite raggiunto (rosso)
 *  - == 1 : ultimo salto (ambra)
 *  - == 2 : pre-allerta (giallo)
 */
export function getSkipRisk(skipRemaining: number | undefined | null): SkipRisk {
  const n = Number.isFinite(skipRemaining as number)
    ? (skipRemaining as number)
    : MAX_PAGOPA_SKIPS;

  if (n <= 0) {
    return { level: 'limit', cls: 'text-red-600',   title: 'Limite salti raggiunto — rischio decadenza' };
  }
  if (n === 1) {
    return { level: 'last',  cls: 'text-amber-600', title: 'Ultimo salto disponibile' };
  }
  if (n === 2) {
    return { level: 'low',   cls: 'text-yellow-600',title: 'Attenzione: 2 salti residui' };
  }
  return null;
}