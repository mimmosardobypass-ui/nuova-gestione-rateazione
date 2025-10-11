import type { CanonicalType } from '../types/advStats';

const CANONICALS = ['F24', 'PAGOPA', 'ROTTAMAZIONE_QUATER', 'RIAMMISSIONE_QUATER', 'ALTRO'] as const;

const MAP = new Map<string, CanonicalType>([
  ['f24', 'F24'],
  ['pagopa', 'PAGOPA'],
  ['pago pa', 'PAGOPA'],
  ['rottamazione quater', 'ROTTAMAZIONE_QUATER'],
  ['rottamazione_quater', 'ROTTAMAZIONE_QUATER'],
  ['riam. quater', 'RIAMMISSIONE_QUATER'],
  ['riammissione quater', 'RIAMMISSIONE_QUATER'],
  ['riammissione_quater', 'RIAMMISSIONE_QUATER'],
  ['altro', 'ALTRO'],
]);

export function normalizeTypeLabel(label?: string | null): CanonicalType | null {
  if (!label) return null;
  
  const trimmed = label.trim();
  
  // Consenti già canonici (case-sensitive check)
  if ((CANONICALS as readonly string[]).includes(trimmed)) {
    return trimmed as CanonicalType;
  }
  
  // Altrimenti cerca nella mappa case-insensitive
  const key = trimmed.toLowerCase();
  return MAP.get(key) ?? null;
}

export function buildTypesArg(labels?: string[] | null): CanonicalType[] | null {
  if (!labels || labels.length === 0) return null; // nessuna selezione ⇒ tutti
  
  const normalized = Array.from(
    new Set(
      labels
        .map(normalizeTypeLabel)
        .filter((t): t is CanonicalType => t !== null)
    )
  );
  
  return normalized.length > 0 ? normalized : null;
}

export function buildStatusesArg(statuses?: string[] | null): string[] | null {
  if (!statuses || statuses.length === 0) return null;
  
  const normalized = Array.from(
    new Set(
      statuses
        .map(s => (s || '').trim().toLowerCase())
        .filter(s => s !== '')
    )
  );
  
  return normalized.length > 0 ? normalized : null;
}
