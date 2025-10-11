/**
 * Utility centralizzato per costruire parametri RPC e mappare tipologie UI↔DB
 * Con mapping adattivo per valori legacy (Quater, Riam.Quater) → canonici
 */

// Tipi canonici nel DB (post-mapping nella vista v_rateations_stats_source)
const CANONICALS = ['F24', 'PAGOPA', 'ROTTAMAZIONE_QUATER', 'RIAMMISSIONE_QUATER', 'ALTRO'] as const;
export type CanonicalType = typeof CANONICALS[number];

// Mapping UI → DB (case-insensitive, gestisce tutte le varianti)
const TYPE_LABEL_TO_CANONICAL_ENTRIES: Array<[string, CanonicalType]> = [
  // F24
  ['f24', 'F24'],
  ['F24', 'F24'],
  
  // PagoPA (tutte le varianti)
  ['pagopa', 'PAGOPA'],
  ['PagoPA', 'PAGOPA'],
  ['PAGOPA', 'PAGOPA'],
  ['pago pa', 'PAGOPA'],
  ['Pago PA', 'PAGOPA'],
  
  // Rottamazione Quater (varianti legacy + canonico)
  ['quater', 'ROTTAMAZIONE_QUATER'],
  ['Quater', 'ROTTAMAZIONE_QUATER'],
  ['QUATER', 'ROTTAMAZIONE_QUATER'],
  ['rottamazione quater', 'ROTTAMAZIONE_QUATER'],
  ['Rottamazione Quater', 'ROTTAMAZIONE_QUATER'],
  ['ROTTAMAZIONE_QUATER', 'ROTTAMAZIONE_QUATER'],
  ['rottamazione_quater', 'ROTTAMAZIONE_QUATER'],
  
  // Riammissione Quater (varianti legacy + canonico)
  ['riam.quater', 'RIAMMISSIONE_QUATER'],
  ['Riam.Quater', 'RIAMMISSIONE_QUATER'],
  ['RIAM.QUATER', 'RIAMMISSIONE_QUATER'],
  ['riam. quater', 'RIAMMISSIONE_QUATER'],
  ['Riam. Quater', 'RIAMMISSIONE_QUATER'],
  ['riammissione quater', 'RIAMMISSIONE_QUATER'],
  ['Riammissione Quater', 'RIAMMISSIONE_QUATER'],
  ['RIAMMISSIONE_QUATER', 'RIAMMISSIONE_QUATER'],
  ['riammissione_quater', 'RIAMMISSIONE_QUATER'],
  
  // Altro
  ['altro', 'ALTRO'],
  ['Altro', 'ALTRO'],
  ['ALTRO', 'ALTRO'],
];

const TYPE_LABEL_TO_CANONICAL = new Map<string, CanonicalType>(
  TYPE_LABEL_TO_CANONICAL_ENTRIES
);

/**
 * Normalizza un'etichetta UI al tipo canonico DB
 * @param label - Etichetta UI (es. "PagoPA", "Riam.Quater")
 * @returns Tipo canonico o null se non riconosciuto
 */
export function normalizeTypeLabel(label: string): CanonicalType | null {
  if (!label) return null;
  const key = label.trim().toLowerCase();
  return TYPE_LABEL_TO_CANONICAL.get(key) ?? null;
}

/**
 * Costruisce il parametro p_types per la RPC get_filtered_stats
 * 
 * REGOLA CHIAVE (FIX BUG):
 * - [] (nessuna selezione) → ritorna null (= tutti i tipi)
 * - [1+] (selezione esplicita) → ritorna SEMPRE l'array canonico
 * 
 * PRIMA: Se l'utente selezionava tutte le tipologie manualmente, ritornava null
 *        → indistinguibile da "nessuna selezione"
 * DOPO:  Qualsiasi selezione esplicita (anche tutte) ritorna sempre l'array
 * 
 * @param typeLabels - Array di etichette UI selezionate dall'utente
 * @returns Array di tipi canonici o null (tutti)
 */
export function buildTypesArg(typeLabels: string[] | null | undefined): CanonicalType[] | null {
  // Nessuna selezione → tutti i tipi (null)
  if (!typeLabels || typeLabels.length === 0) return null;
  
  // Mappa e rimuovi duplicati
  const mapped = typeLabels
    .map(label => normalizeTypeLabel(label))
    .filter((x): x is CanonicalType => Boolean(x));
  
  // Se dopo il mapping non resta nulla, considera "tutti"
  return mapped.length > 0 ? Array.from(new Set(mapped)) : null;
}

/**
 * Costruisce il parametro p_statuses per la RPC get_filtered_stats
 * Gli status nel DB sono lowercase, normalizziamo sempre
 * 
 * @param statuses - Array di status UI (es. ['attiva', 'INTERROTTA'])
 * @returns Array di status lowercase o null (tutti)
 */
export function buildStatusesArg(statuses: string[] | null | undefined): string[] | null {
  if (!statuses || statuses.length === 0) return null;
  
  const normalized = statuses
    .map(s => (s ?? '').toString().trim().toLowerCase())
    .filter(Boolean);
  
  return normalized.length > 0 ? Array.from(new Set(normalized)) : null;
}

/**
 * Mapping inverso: tipo canonico DB → etichetta display UI
 * Usato per mostrare nomi puliti in tabelle/grafici
 */
export const DB_TO_DISPLAY: Record<CanonicalType, string> = {
  'F24': 'F24',
  'PAGOPA': 'PagoPA',
  'ROTTAMAZIONE_QUATER': 'Rottamazione Quater',
  'RIAMMISSIONE_QUATER': 'Riam. Quater',
  'ALTRO': 'Altro',
};
