import type { Rata } from "./adrRates.types";
import { getPdfDocument } from '@/lib/pdfjs';
import { createWorkerCompat } from './ocrWorker';

type Word = { text: string; x: number; y: number; w: number; h: number; lineY: number };

const normDate = (d: string, m: string, y: string) =>
  `${d.padStart(2,"0")}-${m.padStart(2,"0")}-${y}`;

function sanitizeDigits(s: string): string {
  return s
    .replace(/[lI]/g, "1")
    .replace(/O/g, "0")
    .replace(/S/g, "5")
    .replace(/B/g, "8")
    .replace(/[,·]/g, ",")     // virgole "strane"
    .replace(/\s+/g, "");
}

function eurosToNumber(txt: string): number {
  const clean = sanitizeDigits(txt.replace(/[€\s]/g, ""));
  const m = clean.match(/^(\d{1,3}(?:\.\d{3})*),(\d{2})$/);
  if (!m) return NaN;
  const intPart = m[1].replace(/\./g, "");
  return parseFloat(`${intPart}.${m[2]}`);
}

const looksAmount = (s: string) =>
  /\d{1,3}(?:\.\d{3})*,\d{2}$/.test(sanitizeDigits(s.replace(/\s|€/g, "")));

function tolYFor(h: number): number {
  return Math.max(6, Math.round(h * 0.9)); // 6–14 tipicamente
}

function toWords(data: any): Word[] {
  const out: Word[] = [];
  for (const w of data?.words || []) {
    const bbox = w.bbox;
    if (!bbox || bbox.length < 4) continue;
    const [x0, y0, x1, y1] = bbox;
    out.push({
      text: String(w.text ?? ""),
      x: x0, y: y0, w: x1 - x0, h: y1 - y0,
      lineY: (y0 + y1) / 2,
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
  lines.sort((a,b) => a.y - b.y); // dall'alto al basso
  for (const L of lines) L.words.sort((a,b) => a.x - b.x);
  return lines;
}

const join = (arr: Word[], sp=false) => arr.map(w=>w.text).join(sp?" ":"");

function findDatesMultiWord(lines: Array<{y:number;words:Word[] }>) {
  const dates: Array<{ anchor: Word; dd:string; mm:string; yyyy:string }> = [];
  for (const L of lines) {
    const lineText = join(L.words, true);
    if (/TOTALE\s+COMPLESSIVAMENT[EA]\s+DOVUTO/i.test(lineText)) continue;

    for (let i=0;i<L.words.length;i++){
      for (let win=1; win<=6 && i+win<=L.words.length; win++){
        const slice = L.words.slice(i, i+win);
        const joined = sanitizeDigits(join(slice, false));
        const m = joined.match(/(\d{1,2})\s*[-\/\.]\s*(\d{1,2})\s*[-\/\.]\s*(\d{4})/);
        if (m){
          dates.push({ anchor: slice[slice.length-1], dd:m[1], mm:m[2], yyyy:m[3] });
          i = i + win - 1;
          break;
        }
      }
    }
  }
  return dates;
}

function stitchAmountRightOf(words: Word[], anchor: Word, tolY: number): string | null {
  const band = words
    .filter(w => w.x > anchor.x && Math.abs(w.lineY - anchor.lineY) <= tolY)
    .sort((a, b) => a.x - b.x);

  for (let win = 6; win >= 1; win--) {
    for (let i = 0; i <= band.length - win; i++) {
      const slice = band.slice(i, i + win);
      const joined = sanitizeDigits(join(slice, false).replace(/\s/g, ""));
      if (looksAmount(joined)) {
        const m = joined.match(/(\d{1,3}(?:\.\d{3})*),(\d{2})/);
        if (m) return `${m[1]},${m[2]}`;
      }
    }
  }
  return null;
}

export async function extractRatesFromOCR(file: File, onProgress?: (p:number)=>void): Promise<Rata[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await getPdfDocument({ data: arrayBuffer });

  // Worker OCR (singolo, riusato per tutte le pagine)
  const worker = await createWorkerCompat("ita+eng", (m: any) => { 
    if (onProgress && m.progress) {
      onProgress(Math.round(m.progress * 100)); 
    }
  });

  const found: Record<string, Rata> = {};

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    // render ad alta definizione
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvasContext: ctx as any, viewport }).promise;

    const { data: ocr } = await worker.recognize(canvas);
    const words = toWords(ocr);
    if (!words.length) { 
      canvas.width = canvas.height = 0; 
      continue; 
    }

    const lines = groupByLineY(words, 6);
    const dates = findDatesMultiWord(lines);

    for (const d of dates) {
      let amountTxt = stitchAmountRightOf(words, d.anchor, tolYFor(d.anchor.h));
      if (!amountTxt) amountTxt = stitchAmountRightOf(words, d.anchor, tolYFor(d.anchor.h) * 2);
      if (!amountTxt) continue;

      const value = eurosToNumber(amountTxt);
      if (!isFinite(value)) continue;

      const scadenza = normDate(d.dd, d.mm, d.yyyy);
      found[scadenza] = { scadenza, totaleEuro: value, year: parseInt(d.yyyy, 10) };
    }

    canvas.width = canvas.height = 0; // free RAM
  }

  await worker.terminate();
  try { await pdf.cleanup(); } catch {}
  try { await pdf.destroy(); } catch {}

  return Object.values(found).sort((a, b) => {
    const ka = a.scadenza.split("-").reverse().join("");
    const kb = b.scadenza.split("-").reverse().join("");
    return ka.localeCompare(kb);
  });
}