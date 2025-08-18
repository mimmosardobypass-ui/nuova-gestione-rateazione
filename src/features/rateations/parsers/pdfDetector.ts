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
  const allText = pages.map(p => p.text).join(' ').toLowerCase();
  
  // F24 indicators (from commercialista software)
  const f24Indicators = [
    'piano di ammortamento',
    'piano di pagamento',
    'f24',
    'commercialista',
    'software',
    'gestionale',
    'versamento',
    'codice tributo'
  ];
  
  // PagoPA indicators (from Agenzia delle Entrate)
  const pagopaIndicators = [
    'agenzia delle entrate',
    'agenzia entrate-riscossione',
    'ader',
    'pagopa',
    'n. modulo pagamento',
    'data scadenza',
    'totale da pagare',
    'importo debito da pagare',
    'interessi di dilazione',
    'codice avviso',
    'ente creditore'
  ];
  
  // Count matches for each format
  const f24Score = f24Indicators.reduce((score, indicator) => {
    return score + (allText.includes(indicator) ? 1 : 0);
  }, 0);
  
  const pagopaScore = pagopaIndicators.reduce((score, indicator) => {
    return score + (allText.includes(indicator) ? 1 : 0);
  }, 0);
  
  // Additional scoring based on text patterns
  let f24Bonus = 0;
  let pagopaBonus = 0;
  
  // F24: Look for typical structure patterns
  if (/rata\s+\d+/.test(allText)) f24Bonus += 2;
  if (/\d{2}\/\d{2}\/\d{4}.*\d{1,3}\.\d{3},\d{2}/.test(allText)) f24Bonus += 2;
  
  // PagoPA: Look for structured table headers
  if (/n\.\s*modulo.*data\s*scadenza.*totale\s*da\s*pagare/.test(allText)) pagopaBonus += 3;
  if (/importo\s*debito.*interessi\s*di\s*dilazione/.test(allText)) pagopaBonus += 2;
  
  const totalF24 = f24Score + f24Bonus;
  const totalPagoPA = pagopaScore + pagopaBonus;
  
  // Determine format and confidence
  if (totalF24 > totalPagoPA && totalF24 >= 2) {
    return {
      format: 'F24',
      confidence: Math.min(totalF24 / 5, 1), // Normalize to 0-1
      indicators: f24Indicators.filter(ind => allText.includes(ind))
    };
  } else if (totalPagoPA > totalF24 && totalPagoPA >= 2) {
    return {
      format: 'PAGOPA',
      confidence: Math.min(totalPagoPA / 5, 1), // Normalize to 0-1  
      indicators: pagopaIndicators.filter(ind => allText.includes(ind))
    };
  }
  
  return {
    format: 'UNKNOWN',
    confidence: 0,
    indicators: []
  };
}

/**
 * Utility to check if detected format is reliable
 */
export function isFormatReliable(detection: PDFDetectionResult): boolean {
  return detection.confidence >= 0.6 && detection.indicators.length >= 2;
}