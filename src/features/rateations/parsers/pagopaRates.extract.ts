import type { Rata } from "./adrRates.types";
import { extractRatesFromTextLayer } from "./pagopaRates.textlayer";
import { extractRatesFromOCR } from "./pagopaRates.ocr";

export type ExtractOptions = {
  minExpected?: number;                 // default 10 for PagoPA
  onPhase?: (phase: "text"|"ocr"|"done") => void;
  onProgress?: (p: number) => void;     // OCR progress
};

function mergeByDate(a: Rata[], b: Rata[]): Rata[] {
  const map = new Map<string, Rata>();
  for (const r of [...a, ...b]) map.set(r.scadenza, r); // OCR overwrites TL if same date
  return [...map.values()].sort((x, y) => {
    const kx = x.scadenza.split("-").reverse().join(""); 
    const ky = y.scadenza.split("-").reverse().join("");
    return kx.localeCompare(ky);
  });
}

export async function extractPagopaRates(file: File, opt: ExtractOptions = {}): Promise<Rata[]> {
  const minExpected = opt.minExpected ?? 10;

  console.log(`[PagoPA Extractor] Starting extraction with minExpected=${minExpected}`);

  opt.onPhase?.("text");
  let tl: Rata[] = [];
  
  try {
    tl = await extractRatesFromTextLayer(file);
    console.log(`[PagoPA Extractor] Text-layer extraction found ${tl.length} installments`);
  } catch (error) { 
    console.warn("PagoPA text layer extraction failed:", error);
    tl = []; 
  }

  if (tl.length >= minExpected) {
    console.log(`[PagoPA Extractor] Text-layer sufficient (${tl.length} >= ${minExpected}), skipping OCR`);
    opt.onPhase?.("done");
    return tl;
  }

  // fallback OCR completo (geometrico)
  console.log(`[PagoPA Extractor] Text-layer insufficient (${tl.length} < ${minExpected}), starting OCR fallback`);
  opt.onPhase?.("ocr");
  let ocr: Rata[] = [];
  
  try {
    ocr = await extractRatesFromOCR(file, opt.onProgress);
    console.log(`[PagoPA Extractor] OCR extraction found ${ocr.length} installments`);
  } catch (error) {
    console.warn("PagoPA OCR extraction failed:", error);
    ocr = [];
  }

  const merged = mergeByDate(tl, ocr);
  
  // Log diagnostic information when we have fewer than expected
  if (merged.length < minExpected) {
    console.warn(`[PagoPA Extractor] Hybrid extraction found ${merged.length} installments (expected ${minExpected})`);
    console.log('Text-layer results:', tl.length, 'items');
    console.log('OCR results:', ocr.length, 'items');
    console.table(merged);
  } else {
    console.log(`[PagoPA Extractor] Success! Found ${merged.length} installments`);
  }

  opt.onPhase?.("done");
  return merged;
}