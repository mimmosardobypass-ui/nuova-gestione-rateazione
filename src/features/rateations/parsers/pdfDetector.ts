import type { ExtractedPageText } from '../components/ocr/core/usePDFTextExtractor';

export type PDFFormat = 'F24' | 'PAGOPA' | 'UNKNOWN';

export interface PDFDetectionResult {
  format: PDFFormat;
  confidence: number;
  indicators: string[];
}

/**
 * Auto-detect PDF format based on text content
 */
export function detectPDFFormat(pages: ExtractedPageText[]): PDFDetectionResult {
  const allText = pages.map(p => p.text).join(" ").toLowerCase();
  
  console.log(`[detectPDFFormat] Analyzing text content (${allText.length} chars)`);
  console.log(`[detectPDFFormat] First 500 chars:`, allText.substring(0, 500));

  // Enhanced PagoPA indicators
  const pagopaIndicators = [
    "agenzia delle entrate",
    "agenzia entrate-riscossione", 
    "ader",
    "pagopa",
    "n. modulo pagamento",
    "data scadenza",
    "totale da pagare",
    "importo debito da pagare",
    "interessi di dilazione",
    "codice avviso",
    "ente creditore",
    "piano di dilazione",
    "rateazione",
    "rata numero",
    "scadenza rata",
    "importo rata",
    "avviso di pagamento",
    "codice fiscale ente",
    "piano pagamento",
    "dilazione pagamento",
    "modulo pagamento",
    "importo debito",
    "interessi"
  ];

  const f24Indicators = [
    "piano di ammortamento",
    "piano di pagamento", 
    "f24",
    "commercialista",
    "gestionale",
    "versamento",
    "codice tributo",
    "rata numero"
  ];

  const pagopaScore = pagopaIndicators.reduce((score, indicator) => 
    score + (allText.includes(indicator) ? 1 : 0), 0);
  
  const f24Score = f24Indicators.reduce((score, indicator) => 
    score + (allText.includes(indicator) ? 1 : 0), 0);

  console.log(`[detectPDFFormat] PagoPA score: ${pagopaScore}, F24 score: ${f24Score}`);

  // Bonus patterns for PagoPA
  let pagopaBonus = 0;
  if (/rata\s*\d+\s*di\s*\d+/.test(allText)) pagopaBonus += 2;
  if (/\d{2}\/\d{2}\/\d{4}.*€/.test(allText)) pagopaBonus += 2;
  if (/modulo.*scadenza.*importo/i.test(allText)) pagopaBonus += 3;
  if (/importo.*debito.*interessi/i.test(allText)) pagopaBonus += 2;
  if (/ente\s*creditore/i.test(allText)) pagopaBonus += 2;
  if (/dilazione.*pagamento/i.test(allText)) pagopaBonus += 2;

  // Bonus patterns for F24
  let f24Bonus = 0;
  if (/rata\s+\d+/.test(allText)) f24Bonus += 2;
  if (/\d{2}\/\d{2}\/\d{4}.*\d{1,3}\.\d{3},\d{2}/.test(allText)) f24Bonus += 2;

  const finalPagopaScore = pagopaScore + pagopaBonus;
  const finalF24Score = f24Score + f24Bonus;

  console.log(`[detectPDFFormat] Final scores - PagoPA: ${finalPagopaScore}, F24: ${finalF24Score}`);

  if (finalPagopaScore > finalF24Score && finalPagopaScore >= 2) {
    const confidence = Math.min(finalPagopaScore / 8, 1);
    const indicators = pagopaIndicators.filter(i => allText.includes(i));
    console.log(`[detectPDFFormat] Detected PAGOPA with confidence ${confidence}`);
    return { format: "PAGOPA", confidence, indicators };
  }
  
  if (finalF24Score > finalPagopaScore && finalF24Score >= 2) {
    const confidence = Math.min(finalF24Score / 5, 1);
    const indicators = f24Indicators.filter(i => allText.includes(i));
    console.log(`[detectPDFFormat] Detected F24 with confidence ${confidence}`);
    return { format: "F24", confidence, indicators };
  }

  console.log(`[detectPDFFormat] No clear format detected, returning UNKNOWN`);
  return { format: "UNKNOWN", confidence: 0, indicators: [] };
}

/**
 * Utility to check if detected format is reliable
 */
export function isFormatReliable(detection: PDFDetectionResult): boolean {
  return detection.confidence >= 0.6 && detection.indicators.length >= 2;
}