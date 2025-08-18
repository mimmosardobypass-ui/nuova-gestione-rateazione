import type { Rata } from "./adrRates.types";
import { getPdfDocument } from '@/lib/pdfjs';
import { ocrImageData } from '../components/ocr/core/ocr';

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

function toWords(result: { words?: any[] }): Word[] {
  if (!result.words) return [];
  
  return result.words.map(w => ({
    text: w.text || '',
    x: w.x0 || 0,
    y: w.y0 || 0, 
    w: (w.x1 || 0) - (w.x0 || 0),
    h: (w.y1 || 0) - (w.y0 || 0),
    lineY: w.y0 || 0
  })).filter(w => w.text.trim().length > 0);
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
  const dates: Array<{ day: string; month: string; year: string; words: Word[] }> = [];
  for (const L of lines) {
    const lineText = join(L.words, true);
    if (/TOTALE\s+COMPLESSIVAMENT[EA]\s+DOVUTO/i.test(lineText)) continue;

    for (let i=0;i<L.words.length;i++){
      for (let win=1; win<=6 && i+win<=L.words.length; win++){
        const slice = L.words.slice(i, i+win);
        const joined = sanitizeDigits(join(slice, false));
        const m = joined.match(/(\d{1,2})\s*[-\/\.]\s*(\d{1,2})\s*[-\/\.]\s*(\d{4})/);
        if (m){
          dates.push({ day: m[1], month: m[2], year: m[3], words: slice });
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

  const found: Record<string, Rata> = {};

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const viewport = page.getViewport({ scale: 2.0 });
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Cannot get canvas context');
    
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    await page.render({ canvasContext: ctx, viewport }).promise;
    const imageData = canvas.toDataURL('image/png');
    
    // Use the existing OCR system without problematic worker logger
    const result = await ocrImageData(imageData, (progress) => {
      if (onProgress) {
        const pageProgress = ((p - 1) / pdf.numPages) * 100;
        const totalProgress = pageProgress + (progress / pdf.numPages);
        onProgress(Math.round(totalProgress));
      }
    });
    
    const words = toWords(result);
    const lines = groupByLineY(words);
    const dates = findDatesMultiWord(lines);
    
    for (const { day, month, year, words: dateWords } of dates) {
      const dateKey = normDate(day, month, year);
      if (found[dateKey]) continue;

      for (const anchor of dateWords) {
        const amount = stitchAmountRightOf(words, anchor, tolYFor(anchor.h));
        if (amount) {
          const euros = eurosToNumber(amount);
          if (euros > 0) {
            found[dateKey] = { scadenza: dateKey, totaleEuro: euros, year: parseInt(year) };
            break;
          }
        }
      }
    }
  }
  
  return Object.values(found).sort((a, b) => {
    const kA = a.scadenza.split('-').reverse().join('');
    const kB = b.scadenza.split('-').reverse().join('');
    return kA.localeCompare(kB);
  });
}