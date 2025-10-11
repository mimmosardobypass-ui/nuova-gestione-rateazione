/**
 * Utility centralizzato per costruire parametri RPC e mappare tipologie UI↔DB
 * Usato da tutti gli hook Stats per garantire coerenza
 */

import type { StatsFilters } from "../types/stats";

// UI -> DB (etichette mostrate in UI ---> valori canonici nel DB)
export const TYPE_LABEL_TO_DB: Record<string, string> = {
  "F24": "F24",
  "PagoPA": "PAGOPA",
  "Rottamazione Quater": "Rottamazione Quater",
  "Riam. Quater": "Riammissione Quater",
  "Altro": "ALTRO",
};

// DB -> UI (per mostrare etichette pulite nelle tabelle/grafici)
export const DB_TO_DISPLAY: Record<string, string> = {
  "F24": "F24",
  "PAGOPA": "PagoPA",
  "Rottamazione Quater": "Rottamazione Quater",
  "Riammissione Quater": "Riam. Quater",
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
 * Costruisce p_statuses per le RPC (coerente per tutte)
 * - includeClosed OFF (default operativo):
 *     - se nessuno stato selezionato => [attiva, in_ritardo, completata, decaduta]
 *     - se selezionati => rimuovi interrotta/estinta
 * - includeClosed ON:
 *     - se nessuno stato selezionato => nessun filtro (null)
 *     - se selezionati => usa quelli (così come sono)
 */
export function buildStatusesArg(filters: StatsFilters): string[] | null {
  const toLower = (s?: string) => (s ?? "").toLowerCase();
  const CLOSED = ["interrotta", "estinta"];
  const OPERATIVE = ["attiva", "in_ritardo", "completata", "decaduta"];

  const input = (filters.statuses ?? []).map(toLower);

  if (!filters.includeClosed) {
    if (input.length === 0) return OPERATIVE; // default operativo
    const onlyOpen = input.filter((s) => !CLOSED.includes(s));
    return onlyOpen.length ? onlyOpen : ["__no_match__"];
  }

  // includeClosed ON: nessun filtro se vuoto
  return input.length ? input : null;
}
