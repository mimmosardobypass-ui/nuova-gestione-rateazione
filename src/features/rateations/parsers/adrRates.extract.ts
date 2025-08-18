import type { Rata } from "./adrRates.types";
import { extractRatesFromTextLayer } from "./adrRates.textlayer";
import { extractRatesFromOCR } from "./adrRates.ocr";

export type ExtractOptions = {
  minExpected?: number;                 // default 10
  onPhase?: (phase: "text"|"ocr"|"done") => void;
  onProgress?: (p: number) => void;     // OCR progress
};

export async function extractAdrRates(file: File, opt: ExtractOptions = {}): Promise<Rata[]> {
  const minExpected = opt.minExpected ?? 10;

  opt.onPhase?.("text");
  let rows: Rata[] = [];
  
  try {
    rows = await extractRatesFromTextLayer(file);
  } catch (error) { 
    console.warn("Text layer extraction failed:", error);
    rows = []; 
  }

  if (rows.length >= minExpected) {
    opt.onPhase?.("done");
    return rows;
  }

  // fallback OCR completo (geometrico)
  opt.onPhase?.("ocr");
  let ocrRows: Rata[] = [];
  
  try {
    ocrRows = await extractRatesFromOCR(file, opt.onProgress);
  } catch (error) {
    console.warn("OCR extraction failed:", error);
    ocrRows = [];
  }

  // Scegli il set migliore
  const best = ocrRows.length >= rows.length ? ocrRows : rows;

  opt.onPhase?.("done");
  return best;
}