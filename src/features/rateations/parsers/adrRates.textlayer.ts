import { getPdfDocument } from '@/lib/pdfjs';
import type { Rata } from './adrRates.types';

type Token = { str: string; x: number; y: number; w: number; h: number };

function toTokens(items: any[]): Token[] {
  return (items || []).map((it: any) => ({
    str: String(it.str ?? ""),
    x: Number(it.transform?.[4] ?? 0),
    y: Number(it.transform?.[5] ?? 0),
    w: Number(it.width ?? 0),
    h: Number(it.height ?? 0),
  }));
}

function eurosToNumber(txt: string): number {
  const clean = txt.replace(/[€\s]/g, "");
  const m = clean.match(/^(\d{1,3}(?:\.\d{3})*),(\d{2})$/);
  if (!m) return NaN;
  const intPart = m[1].replace(/\./g, "");
  return parseFloat(`${intPart}.${m[2]}`);
}

const normDate = (d: string, m: string, y: string) =>
  `${d.padStart(2, "0")}-${m.padStart(2, "0")}-${y}`;

const join = (t: Token[], sp = false) => t.map(x => x.str).join(sp ? " " : "");

const looksAmount = (s: string) =>
  /\d{1,3}(?:\.\d{3})*,\d{2}$/.test(s.replace(/\s|€/g, ""));

function stitchAmountRightOf(tokens: Token[], anchor: Token, tolY: number): string | null {
  const band = tokens
    .filter(t => t.x > anchor.x && Math.abs(t.y - anchor.y) <= tolY)
    .sort((a, b) => a.x - b.x);
  
  for (let win = 5; win >= 1; win--) {
    for (let i = 0; i <= band.length - win; i++) {
      const slice = band.slice(i, i + win);
      const joined = join(slice).replace(/\s/g, "");
      if (looksAmount(joined)) {
        const m = joined.match(/(\d{1,3}(?:\.\d{3})*),(\d{2})/);
        if (m) return `${m[1]},${m[2]}`;
      }
    }
  }
  return null;
}

function groupByY(items: Token[], tol = 2) {
  const lines: Array<{ y: number; line: Token[] }> = [];
  for (const it of items) {
    let b = lines.find(L => Math.abs(L.y - it.y) <= tol);
    if (!b) { b = { y: it.y, line: [] }; lines.push(b); }
    b.line.push(it);
  }
  lines.sort((a, b) => b.y - a.y);
  for (const L of lines) L.line.sort((a, b) => a.x - b.x);
  return lines;
}

const isTotals = (s: string) => /TOTALE\s+COMPLESSIVAMENT[EA]\s+DOVUTO/i.test(s);

function findDatesMultiToken(lines: Array<{ y: number; line: Token[] }>) {
  const dates: Array<{ anchor: Token; dd: string; mm: string; yyyy: string }> = [];
  for (const L of lines) {
    const tokens = L.line;
    const lineText = tokens.map(t => t.str).join(" ").replace(/\s+/g, " ").trim();
    if (isTotals(lineText)) continue;
    
    for (let i = 0; i < tokens.length; i++) {
      for (let win = 1; win <= 6 && i + win <= tokens.length; win++) {
        const slice = tokens.slice(i, i + win);
        const joined = join(slice, false);
        const m = joined.match(/(\d{1,2})\s*[-\/\.]\s*(\d{1,2})\s*[-\/\.]\s*(\d{4})/);
        if (m) {
          dates.push({ anchor: slice[slice.length - 1], dd: m[1], mm: m[2], yyyy: m[3] });
          i = i + win - 1;
          break;
        }
      }
    }
  }
  return dates;
}

export async function extractRatesFromTextLayer(file: File): Promise<Rata[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await getPdfDocument({ data: arrayBuffer });

  const found: Record<string, Rata> = {};
  
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content: any = await page.getTextContent();
    const items = content.items || [];
    if (!items.length) continue; // pagina senza text-layer

    const tokens = toTokens(items);
    const lines = groupByY(tokens, 2);
    const dates = findDatesMultiToken(lines);

    for (const d of dates) {
      let amountTxt = stitchAmountRightOf(tokens, d.anchor, 6);
      if (!amountTxt) amountTxt = stitchAmountRightOf(tokens, d.anchor, 12);
      if (!amountTxt) continue;
      
      const value = eurosToNumber(amountTxt);
      if (!isFinite(value)) continue;
      
      const scadenza = normDate(d.dd, d.mm, d.yyyy);
      found[scadenza] = { scadenza, totaleEuro: value, year: parseInt(d.yyyy, 10) };
    }
  }

  try { await pdf.cleanup(); } catch {}
  try { await pdf.destroy(); } catch {}

  return Object.values(found).sort((a, b) => {
    const ka = a.scadenza.split("-").reverse().join(""); // yyyyMMdd
    const kb = b.scadenza.split("-").reverse().join("");
    return ka.localeCompare(kb);
  });
}