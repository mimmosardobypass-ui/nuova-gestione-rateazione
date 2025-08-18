import type { ParsingProfile } from '../types';

// Profilo di parsing specifico per l'Agenzia delle Entrate-Riscossione
export const AgenziaRiscossioneProfile: ParsingProfile = {
  id: 'agenzia-riscossione-tabellare',
  name: 'Agenzia delle Entrate-Riscossione (Tabellare)',
  columnMappings: {
    // Pattern per text-layer parsing
    seqPattern: String.raw`^\s*(\d{2})\s+`,
    datePattern: String.raw`(\d{2}\/\d{2}\/\d{4})`,
    amountPattern: String.raw`(\d{1,3}(?:\.\d{3})*,\d{2})\s*$`, // Totale da pagare
    
    // Pattern specifici per questo formato
    debitoPattern: String.raw`Importo debito[^€]*€?\s*(\d{1,3}(?:\.\d{3})*,\d{2})`,
    interessiPattern: String.raw`Interessi[^€]*€?\s*(\d{1,3}(?:\.\d{3})*,\d{2})`,
  },
};

// Funzione di detection per auto-riconoscimento del profilo
export function detectAgenziaRiscossione(text: string): boolean {
  const requiredKeywords = [
    'Interessi di dilazione',
    'Totale da pagare',
    'N. Modulo pagamento',
    'Data scadenza',
    'Importo debito da pagare'
  ];
  
  const foundKeywords = requiredKeywords.filter(keyword => 
    text.toLowerCase().includes(keyword.toLowerCase())
  );
  
  // Richiede almeno 3 delle 5 keywords per essere considerato valido
  return foundKeywords.length >= 3;
}

// Headers per text-layer parsing
export const AGENZIA_HEADERS = [
  'N. Modulo pagamento',
  'Data scadenza', 
  'Importo debito da pagare',
  'Interessi di dilazione',
  'Totale da pagare'
];

// Pattern per escludere righe non valide
export const EXCLUSION_PATTERNS = [
  /totale complessivamente dovuto/i,
  /piano di pagamento/i,
  /codice tributo/i,
  /^[-=\s]*$/,
  /intestazione/i,
  /agenzia delle entrate/i,
];

// Post-processing specifico per questo profilo
export function postProcessAgenziaRow(rawData: Record<string, string>) {
  return {
    seq: parseInt(rawData.seq?.replace(/\D/g, '') || '0', 10),
    due_date: rawData.due?.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$2-$1') || '',
    amount: parseFloat(rawData.totale?.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '') || '0'),
    description: `N. Modulo ${rawData.seq} - ${rawData.due}`,
    debito: rawData.debito ? parseFloat(rawData.debito.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '') || '0') : undefined,
    interessi: rawData.interessi ? parseFloat(rawData.interessi.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '') || '0') : undefined,
    notes: rawData.interessi ? `Interessi di dilazione: ${rawData.interessi}` : undefined,
  };
}