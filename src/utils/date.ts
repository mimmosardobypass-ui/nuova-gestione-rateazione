// src/utils/date.ts
const IT_MONTHS: Record<string, string> = {
  gen: '01', gennaio: '01',
  feb: '02', febbraio: '02',
  mar: '03', marzo: '03',
  apr: '04', aprile: '04',
  mag: '05', maggio: '05',
  giu: '06', giugno: '06',
  lug: '07', luglio: '07',
  ago: '08', agosto: '08',
  set: '09', settembre: '09',
  ott: '10', ottobre: '10',
  nov: '11', novembre: '11',
  dic: '12', dicembre: '12',
};

/**
 * Corregge i classici errori OCR nei caratteri (O→0, l/I→1, etc.)
 */
function normalizeOcrDigits(input: string): string {
  return input
    .replace(/[Oo]/g, '0')
    .replace(/[Il]/g, '1')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Trova una data italiana nel testo e ritorna ISO (YYYY-MM-DD).
 * Gestisce:
 *  - 02/11/2024, 02-11-2024, 02.11.2024
 *  - 2/11/24 (espande 24→2024)
 *  - 2 nov 2024 / 2 novembre 2024 (mesi in italiano)
 *  - spazi e rumore OCR
 */
export function parseItalianDateToISO(text: string): string | null {
  const clean = normalizeOcrDigits(text.toLowerCase());

  // 1) DD[./-]MM[./-]YYYY o DD[./-]MM[./-]YY
  const m1 = clean.match(
    /(^|[^0-9])(\d{1,2})\s*[-/.]\s*(\d{1,2})\s*[-/.]\s*(\d{2,4})([^0-9]|$)/
  );
  if (m1) {
    let dd = m1[2].padStart(2, '0');
    let mm = m1[3].padStart(2, '0');
    let yy = m1[4];
    if (yy.length === 2) yy = `20${yy}`;
    return `${yy}-${mm}-${dd}`;
  }

  // 2) "2 nov 2024" / "2 novembre 2024"
  const monthKeys = Object.keys(IT_MONTHS).join('|');
  const m2 = clean.match(
    new RegExp(`(^|[^0-9])(\\d{1,2})\\s*(${monthKeys})\\s*(\\d{2,4})([^0-9]|$)`)
  );
  if (m2) {
    let dd = m2[2].padStart(2, '0');
    let mm = IT_MONTHS[m2[3]];
    let yy = m2[4];
    if (yy.length === 2) yy = `20${yy}`;
    return `${yy}-${mm}-${dd}`;
  }

  return null;
}

/**
 * Valida una stringa ISO (YYYY-MM-DD) - versione sicura senza UTC
 */
export function isValidISODate(s?: string): boolean {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/**
 * Converte un Date in YYYY-MM-DD in locale senza shift di timezone
 */
export function toLocalISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Per UI: ISO (YYYY-MM-DD) -> italiano "DD-MM-YYYY"
 */
export function formatISOToItalian(iso: string): string {
  if (!iso || !isValidISODate(iso)) return iso ?? '';
  const [y, m, d] = iso.split('-');
  return `${d.padStart(2, '0')}-${m.padStart(2, '0')}-${y}`;
}

/**
 * Alias per coerenza con la proposta dell'utente
 */
export const toISODateLocal = toLocalISO;