/**
 * Utility centralizzato per costruire parametri RPC e mappare tipologie UI↔DB
 * Usato da tutti gli hook Stats per garantire coerenza
 */

import type { StatsFilters } from "../types/stats";

// UI -> DB (etichette mostrate in UI ---> valori canonici nel DB)
export const TYPE_LABEL_TO_DB: Record<string, string> = {
  "F24": "F24",
  "PagoPA": "PAGOPA",
  "Rottamazione Quater": "Quater",
  "Riam. Quater": "Riam.Quater",
  "Altro": "ALTRO",
};

// DB -> UI (per mostrare etichette pulite nelle tabelle/grafici)
export const DB_TO_DISPLAY: Record<string, string> = {
  "F24": "F24",
  "PAGOPA": "PagoPA",
  "Quater": "Rottamazione Quater",
  "Riam.Quater": "Riam. Quater",
  "ALTRO": "Altro",
};

/**
 * Costruisce p_type_labels per le RPC
 * Nessuna selezione o tutte selezionate => nessun filtro (null)
 */
export function buildTypesArg(selected: string[] | null | undefined): string[] | null {
  const labels = selected ?? [];
  const ALL = Object.keys(TYPE_LABEL_TO_DB);
  if (labels.length === 0 || labels.length === ALL.length) return null;
  return labels.map((l) => TYPE_LABEL_TO_DB[l] ?? l);
}

/**
 * Costruisce p_statuses: normalizza in lowercase, tutti => NULL
 * La logica includeClosed viene gestita direttamente nel filtro UI
 */
export function buildStatusesArg(filters: StatsFilters): string[] | null {
  const input = (filters.statuses ?? []).map(s => s.toLowerCase());
  
  // Nessuno stato selezionato => NULL (tutti gli stati)
  if (input.length === 0) return null;
  
  return input;
}
