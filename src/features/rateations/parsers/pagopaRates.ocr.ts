import { getDocument } from "pdfjs-dist";
import type { Rata } from "./adrRates.types";
import { ocrImageData } from "../components/ocr/core/ocr";

type Word = { text: string; x: number; y: number; w: number; h: number; lineY: number };

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

const joinW = (w: Word[], sp = false) => w.map(x => x.text).join(sp ? " " : "");

function toWords(result: { words?: any[] }): Word[] {
  const out: Word[] = [];
  for (const w of result?.words || []) {
    if (!w.bbox || w.bbox.length < 4) continue;
    const [x0, y0, x1, y1] = w.bbox;
    out.push({ 
      text: String(w.text ?? ""), 
      x: x0, 
      y: y0, 
      w: x1 - x0, 
      h: y1 - y0, 
      lineY: (y0 + y1) / 2 
    });
  }
  return out;
}

function groupByLineY(words: Word[], tol = 6) {
  const lines: Array<{ y: number; words: Word[] }> = [];
  for (const w of words) {
    let b = lines.find(L => Math.abs(L.y - w.lineY) <= tol);
    if (!b) { b = { y: w.lineY, words: [] }; lines.push(b); }
    b.words.push(w);
  }
  lines.sort((a, b) => a.y - b.y);
  for (const L of lines) L.words.sort((a, b) => a.x - b.x);
  return lines;
}

function findDatesMultiWord(lines: Array<{ y: number; words: Word[] }>) {
  const dates: Array<{ anchor: Word; dd: string; mm: string; yyyy: string }> = [];
  for (const L of lines) {
    const lineText = joinW(L.words, true);
    if (isTotals(lineText)) continue;
    
    // Skip PagoPA headers
    if (/n\.\s*modulo\s*pagamento|data\s*scadenza|totale\s*da\s*pagare/i.test(lineText)) continue;
    
    for (let i = 0; i < L.words.length; i++) {
      for (let win = 1; win <= 6 && i + win <= L.words.length; win++) {
        const slice = L.words.slice(i, i + win);
        const j = sanitizeDigits(joinW(slice, false));
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

function stitchAmountRightOf(words: Word[], anchor: Word, tolY: number) {
  const band = words.filter(w => w.x > anchor.x && Math.abs(w.lineY - anchor.lineY) <= tolY).sort((a, b) => a.x - b.x);
  for (let win = 6; win >= 1; win--) {
    for (let i = 0; i <= band.length - win; i++) {
      const slice = band.slice(i, i + win);
      const joined = sanitizeDigits(joinW(slice, false));
      if (looksAmount(joined)) {
        const m = joined.match(/(\d{1,3}(?:\.\d{3})*),(\d{2})/);
        if (m) return `${m[1]},${m[2]}`;
      }
    }
  }
  return null;
}

export async function extractRatesFromOCR(file: File, onProgress?: (p: number) => void): Promise<Rata[]> {
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await getDocument({ data }).promise;
  const found: Record<string, Rata> = {};

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvasContext: ctx as any, viewport }).promise;

    const imageData = canvas.toDataURL("image/png");
    const result = await ocrImageData(imageData, onProgress);
    const words = toWords(result);
    const lines = groupByLineY(words, 6);
    const dates = findDatesMultiWord(lines);

    console.log(`[PagoPA OCR] Page ${p}: Found ${dates.length} potential dates from ${words.length} words`);

    for (const d of dates) {
      let amountTxt = stitchAmountRightOf(words, d.anchor, tolYFor(d.anchor.h));
      if (!amountTxt) amountTxt = stitchAmountRightOf(words, d.anchor, tolYFor(d.anchor.h) * 2);
      if (!amountTxt) continue;
      
      const value = eurosToNumber(amountTxt);
      if (!isFinite(value)) continue;
      
      const scadenza = normDate(d.dd, d.mm, d.yyyy);
      found[scadenza] = { scadenza, totaleEuro: value, year: parseInt(d.yyyy, 10) };
      
      console.log(`[PagoPA OCR] Found: ${scadenza} → ${value}€ at (${d.anchor.x}, ${d.anchor.lineY})`);
    }

    canvas.width = canvas.height = 0;
  }

  try { await pdf.cleanup(); } catch { }
  try { await pdf.destroy(); } catch { }
  
  const result = Object.values(found).sort(byChrono);
  console.log(`[PagoPA OCR] Final result: ${result.length} installments`);
  console.table(result);
  
  return result;
}