import { getDocument } from "pdfjs-dist";
import type { Rata } from "./adrRates.types";

type Token = { str: string; x: number; y: number; w: number; h: number };

// Utility functions
function sanitizeDigits(s: string) {
  return s
    .replace(/[lI]/g, "1")
    .replace(/O/g, "0")
    .replace(/S/g, "5")
    .replace(/B/g, "8")
    .replace(/·/g, ",")
    .replace(/\s+/g, "");
}

function eurosToNumber(txt: string): number {
  const clean = sanitizeDigits(txt).replace(/[€\s]/g, "");
  const m = clean.match(/^(\d{1,3}(?:\.\d{3})*),(\d{2})$/);
  if (!m) return NaN;
  const intPart = m[1].replace(/\./g, "");
  return parseFloat(`${intPart}.${m[2]}`);
}

const normDate = (d: string, m: string, y: string) => `${d.padStart(2, "0")}-${m.padStart(2, "0")}-${y}`;
const looksAmount = (s: string) => /\d{1,3}(?:\.\d{3})*,\d{2}$/.test(sanitizeDigits(s).replace(/\s|€/g, ""));
const isTotals = (s: string) => /TOTALE\s+COMPLESSIVAMENTE\s+DOVUTO/i.test(s);
const byChrono = (a: { scadenza: string }, b: { scadenza: string }) =>
  a.scadenza.split("-").reverse().join("").localeCompare(b.scadenza.split("-").reverse().join(""));
function tolYFor(h: number) { return Math.max(6, Math.round(h * 0.9)); }

const joinT = (t: Token[], sp = false) => t.map(x => x.str).join(sp ? " " : "");
const looksDate = (s: string) => /(\d{1,2})\s*[-\/\.]\s*(\d{1,2})\s*[-\/\.]\s*(\d{4})/.test(s);

function toTokens(items: any[]): Token[] {
  return (items || []).map((it: any) => ({
    str: String(it.str ?? ""),
    x: Number(it.transform?.[4] ?? 0),
    y: Number(it.transform?.[5] ?? 0),
    w: Number(it.width ?? 0),
    h: Number(it.height ?? 0),
  }));
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

function stitchAmountRightOf(tokens: Token[], anchor: Token, tolY: number) {
  const band = tokens.filter(t => t.x > anchor.x && Math.abs(t.y - anchor.y) <= tolY).sort((a, b) => a.x - b.x);
  for (let win = 5; win >= 1; win--) {
    for (let i = 0; i <= band.length - win; i++) {
      const slice = band.slice(i, i + win);
      const joined = sanitizeDigits(joinT(slice, false));
      if (looksAmount(joined)) {
        const m = joined.match(/(\d{1,3}(?:\.\d{3})*),(\d{2})/);
        if (m) return `${m[1]},${m[2]}`;
      }
    }
  }
  return null;
}

function findDatesMultiToken(lines: Array<{ y: number; line: Token[] }>) {
  const dates: Array<{ anchor: Token; dd: string; mm: string; yyyy: string }> = [];
  for (const L of lines) {
    const txt = L.line.map(t => t.str).join(" ").replace(/\s+/g, " ").trim();
    if (isTotals(txt)) continue;
    
    // Skip lines that look like headers for PagoPA
    if (/n\.\s*modulo\s*pagamento|data\s*scadenza|totale\s*da\s*pagare/i.test(txt)) continue;
    
    for (let i = 0; i < L.line.length; i++) {
      for (let win = 1; win <= 6 && i + win <= L.line.length; win++) {
        const slice = L.line.slice(i, i + win);
        const j = sanitizeDigits(joinT(slice, false));
        const m = j.match(/(\d{1,2})[-\/\.](\d{1,2})[-\/\.](\d{4})/);
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
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await getDocument({ data }).promise;
  const found: Record<string, Rata> = {};

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content: any = await page.getTextContent();
    const items = content.items || [];
    if (!items.length) continue;

    const tokens = toTokens(items);
    const lines = groupByY(tokens, 2);
    const dates = findDatesMultiToken(lines);

    console.log(`[PagoPA Text-Layer] Page ${p}: Found ${dates.length} potential dates`);

    for (const d of dates) {
      let amountTxt = stitchAmountRightOf(tokens, d.anchor, tolYFor(d.anchor.h));
      if (!amountTxt) amountTxt = stitchAmountRightOf(tokens, d.anchor, tolYFor(d.anchor.h) * 2);
      if (!amountTxt) continue;

      const value = eurosToNumber(amountTxt);
      if (!isFinite(value)) continue;

      const scadenza = normDate(d.dd, d.mm, d.yyyy);
      found[scadenza] = { scadenza, totaleEuro: value, year: parseInt(d.yyyy, 10) };
      
      console.log(`[PagoPA Text-Layer] Found: ${scadenza} → ${value}€ at (${d.anchor.x}, ${d.anchor.y})`);
    }
  }

  try { await pdf.cleanup(); } catch { }
  try { await pdf.destroy(); } catch { }
  
  const result = Object.values(found).sort(byChrono);
  console.log(`[PagoPA Text-Layer] Final result: ${result.length} installments`);
  console.table(result);
  
  return result;
}