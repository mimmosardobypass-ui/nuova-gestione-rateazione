import type { Rata } from "./adrRates.types";
import { extractRatesFromTextLayer } from "./adrRates.textlayer";
import { extractRatesFromOCR } from "./adrRates.ocr";

export type ExtractOptions = {
  minExpected?: number;                 // default 10
  onPhase?: (phase: "text"|"ocr"|"done") => void;
  onProgress?: (p: number) => void;     // OCR progress
};

function mergeByDate(a: Rata[], b: Rata[]): Rata[] {
  const map = new Map<string, Rata>();
  for (const r of [...a, ...b]) map.set(r.scadenza, r); // OCR sovrascrive TL se stesso giorno
  return [...map.values()].sort((x,y)=>{
    const kx = x.scadenza.split("-").reverse().join(""); 
    const ky = y.scadenza.split("-").reverse().join("");
    return kx.localeCompare(ky);
  });
}

export async function extractAdrRates(file: File, opt: ExtractOptions = {}): Promise<Rata[]> {
  const minExpected = opt.minExpected ?? 10;

  opt.onPhase?.("text");
  let tl: Rata[] = [];
  
  try {
    tl = await extractRatesFromTextLayer(file);
  } catch (error) { 
    console.warn("Text layer extraction failed:", error);
    tl = []; 
  }

  if (tl.length >= minExpected) {
    opt.onPhase?.("done");
    return tl;
  }

  // fallback OCR completo (geometrico)
  opt.onPhase?.("ocr");
  let ocr: Rata[] = [];
  
  try {
    ocr = await extractRatesFromOCR(file, opt.onProgress);
  } catch (error) {
    console.warn("OCR extraction failed:", error);
    ocr = [];
  }

  const merged = mergeByDate(tl, ocr);
  
  // Log diagnostic information when we have fewer than expected
  if (merged.length < minExpected) {
    console.warn(`Hybrid extraction found ${merged.length} installments (expected ${minExpected})`);
    console.log('Text-layer results:', tl.length, 'items');
    console.log('OCR results:', ocr.length, 'items');
    console.table(merged);
  }

  opt.onPhase?.("done");
  return merged;
}