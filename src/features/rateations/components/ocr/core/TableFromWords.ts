import type { OCRWord } from './types';

export type ColumnKey = 'seq' | 'date' | 'descrizione' | 'tributo' | 'anno' | 'debito' | 'interessi' | 'da_versare';

export type ColumnBand = {
  key: ColumnKey;
  x0: number;
  x1: number;
  label: string;
};

export type ParsedInstallment = {
  seq: number;
  due_date: string;         // ISO yyyy-mm-dd
  amount: number;           // da_versare oppure debito
  description: string;      // Required to match OCRTextParser
  tributo?: string;
  anno?: string;
  debito?: number;
  interessi?: number;
  notes?: string;
};

const HEADER_HINTS: Record<ColumnKey, string[]> = {
  seq:          ['n°','num','numero'],
  date:         ['rata data','data rata','scadenza'],
  descrizione:  ['descrizione'],
  tributo:      ['tributo'],
  anno:         ['anno'],
  debito:       ['debito'],
  interessi:    ['interessi'],
  da_versare:   ['da versare','versare'],
};

const COL_ORDER: ColumnKey[] = ['seq','date','descrizione','tributo','anno','debito','interessi','da_versare'];

/** Normalizza importi "it-IT" → numero JS */
export function parseAmount(itAmount: string): number {
  if (!itAmount) return 0;
  const s = itAmount
    .replace(/[^\d,.-]/g, '') // togli simboli
    .replace(/\.(?=\d{3}(\D|$))/g, '') // rimuovi separatori migliaia
    .replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

/** Normalizza data italiana dd/mm/yyyy → yyyy-mm-dd */
export function parseDate(itDate: string): string {
  if (!itDate) return '';
  const m = itDate.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (!m) return '';
  let [_, d, mo, y] = m;
  if (y.length === 2) y = (parseInt(y,10) >= 50 ? '19' : '20') + y;
  const dd = d.padStart(2,'0');
  const mm = mo.padStart(2,'0');
  return `${y}-${mm}-${dd}`;
}

/** euristica: prima parola numerica all'inizio riga come seq */
function takeSeq(texts: string[]): number {
  const t = (texts[0] ?? '').replace(/[^\d]/g,'');
  const n = parseInt(t,10);
  return isNaN(n) ? 0 : n;
}

/** Raggruppa parole in righe per prossimità verticale */
function groupByRows(words: OCRWord[], rowTolerance = 10): OCRWord[][] {
  const sorted = [...words].sort((a,b) => (a.y0 + a.y1)/2 - (b.y0 + b.y1)/2);
  const rows: OCRWord[][] = [];
  let current: OCRWord[] = [];
  let currentY = -Infinity;

  for (const w of sorted) {
    const cy = (w.y0 + w.y1)/2;
    if (current.length === 0) {
      current.push(w);
      currentY = cy;
      continue;
    }
    if (Math.abs(cy - currentY) <= rowTolerance) {
      current.push(w);
    } else {
      rows.push(current);
      current = [w];
      currentY = cy;
    }
  }
  if (current.length) rows.push(current);
  return rows.map(r => r.sort((a,b) => a.x0 - b.x0));
}

/** Trova riga intestazione + bande colonne dai testi header */
function detectHeaderBands(rows: OCRWord[][]): { headerIndex: number; bands: ColumnBand[] } | null {
  // Cerca la riga che contiene molte parole-chiave di colonna
  let bestIdx = -1, bestScore = 0;
  for (let i=0;i<rows.length;i++) {
    const line = rows[i].map(w => w.text.toLowerCase()).join(' ');
    let score = 0;
    for (const hints of Object.values(HEADER_HINTS)) {
      if (hints.some(h => line.includes(h))) score++;
    }
    if (score > bestScore) { bestScore = score; bestIdx = i; }
  }
  if (bestIdx < 0) return null;

  const header = rows[bestIdx];
  // cluster parole header in gruppi contigui (per individuare colonne)
  const groups: { text: string; x0: number; x1: number }[] = [];
  let gText = '', gx0 = header[0].x0, gx1 = header[0].x1;
  for (let i=0;i<header.length;i++) {
    const w = header[i];
    if (i>0 && w.x0 - header[i-1].x1 > 15) {
      groups.push({ text: gText.trim(), x0: gx0, x1: gx1 });
      gText = w.text;
      gx0 = w.x0; gx1 = w.x1;
    } else {
      gText += ' ' + w.text;
      gx1 = Math.max(gx1, w.x1);
    }
  }
  groups.push({ text: gText.trim(), x0: gx0, x1: gx1 });

  // mappa i gruppi alle colonne note
  const mapped: ColumnBand[] = [];
  for (const g of groups) {
    const lower = g.text.toLowerCase();
    let key: ColumnKey | null = null;
    for (const k of COL_ORDER) {
      if (HEADER_HINTS[k].some(h => lower.includes(h))) { key = k; break; }
    }
    if (key) mapped.push({ key, x0: g.x0, x1: g.x1, label: g.text });
  }

  // ordina per x e "riempi" colonne mancanti (facoltativo)
  mapped.sort((a,b) => a.x0 - b.x0);

  // Se mancano colonne essenziali, abort
  const haveDate = mapped.some(m => m.key === 'date');
  const haveVers = mapped.some(m => m.key === 'da_versare') || mapped.some(m => m.key === 'debito');
  if (!haveDate || !haveVers) return null;

  // Allarga un po' le bande per catturare parole ai bordi
  const bands = mapped.map(m => ({
    ...m,
    x0: m.x0 - 8,
    x1: m.x1 + 8,
  }));

  return { headerIndex: bestIdx, bands };
}

/** Seleziona le parole della riga che cadono nella banda [x0,x1] */
function takeTextsInBand(row: OCRWord[], band: ColumnBand): string[] {
  return row
    .filter(w => {
      const cx = (w.x0 + w.x1)/2;
      return cx >= band.x0 && cx <= band.x1;
    })
    .map(w => w.text);
}

/** Parser principale: da words → installments */
export function extractInstallmentsFromWords(allWords: OCRWord[]): ParsedInstallment[] {
  if (!allWords?.length) return [];

  // 1) righe
  const rows = groupByRows(allWords, 10 /* px */);

  // 2) header + bande
  const hdr = detectHeaderBands(rows);
  if (!hdr) return []; // fallirà il fallback regex a monte
  const { headerIndex, bands } = hdr;

  // 3) righe dati dopo l'header
  const dataRows = rows.slice(headerIndex + 1);

  const out: ParsedInstallment[] = [];
  for (const r of dataRows) {
    // prendi testi per banda
    const cell: Partial<Record<ColumnKey, string>> = {};
    for (const b of bands) {
      const texts = takeTextsInBand(r, b);
      cell[b.key] = texts.join(' ').replace(/\s+/g,' ').trim();
    }

    // seq: se non c'è banda, prova prima parola della riga
    let seq = cell.seq ? parseInt(cell.seq.replace(/[^\d]/g,''),10) : takeSeq(r.map(w=>w.text));
    if (!seq || isNaN(seq)) seq = out.length + 1;

    // date
    const due = parseDate(cell.date ?? '');

    // amount = "Da versare" preferito, altrimenti Debito
    const amountText = (cell.da_versare ?? cell.debito ?? '').replace(/[^\d,.-]/g,'');
    const amount = parseAmount(amountText);

    // se riga vuota (es. note), salta
    if (!due && !amount) continue;

    out.push({
      seq,
      due_date: due,
      amount,
      description: cell.descrizione || `Rata ${seq}`,
      tributo: cell.tributo,
      anno: (cell.anno ?? '').replace(/[^\d]/g,''),
      debito: cell.debito ? parseAmount(cell.debito) : undefined,
      interessi: cell.interessi ? parseAmount(cell.interessi) : undefined,
      notes: `Estratto OCR bbox`,
    });
  }

  // filtro righe palesemente invalide (zero amount o date N/A)
  return out.filter(r => r.amount > 0 && !!r.due_date);
}