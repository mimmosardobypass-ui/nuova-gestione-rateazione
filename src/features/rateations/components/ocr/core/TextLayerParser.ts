import type { TextItem, ExtractedPageText } from './usePDFTextExtractor';
import type { ParsedInstallment } from '../OCRTextParser';
import { parseItalianDateToISO } from '@/utils/date';

interface TextRow {
  y: number;
  items: TextItem[];
  text: string;
}

interface ColumnBand {
  key: string;
  label: string;
  xMin: number;
  xMax: number;
}

// Normalizzazione data italiana dd/MM/yyyy -> ISO YYYY-MM-DD
export function normalizeItalianDate(dateStr: string): string {
  const match = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return dateStr;
  const [, dd, mm, yyyy] = match;
  return `${yyyy}-${mm}-${dd}`;
}

// Parsing importo europeo con virgola decimale
export function parseEuro(s: string): number {
  // "2.461,33" -> 2461.33
  const clean = s.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '');
  return parseFloat(clean) || 0;
}

// Raggruppa gli elementi di testo per riga (coordinata Y)
export function groupByRows(items: TextItem[], tolerance: number = 3): TextRow[] {
  const rows: TextRow[] = [];
  
  for (const item of items) {
    if (!item.str.trim()) continue;
    
    // Trova riga esistente con Y simile
    let targetRow = rows.find(row => Math.abs(row.y - item.y) <= tolerance);
    
    if (!targetRow) {
      targetRow = {
        y: item.y,
        items: [],
        text: '',
      };
      rows.push(targetRow);
    }
    
    targetRow.items.push(item);
  }
  
  // Ordina righe per Y (dall'alto verso il basso)
  rows.sort((a, b) => b.y - a.y);
  
  // Costruisci testo per ogni riga ordinando gli item per X
  for (const row of rows) {
    row.items.sort((a, b) => a.x - b.x);
    row.text = row.items.map(item => item.str).join(' ').trim();
  }
  
  return rows;
}

// Rileva le bande delle colonne dall'header
export function detectColumnBands(rows: TextRow[]): { headerIndex: number; bands: ColumnBand[] } | null {
  const expectedHeaders = [
    'N. Modulo pagamento',
    'Data scadenza', 
    'Importo debito da pagare',
    'Interessi di dilazione',
    'Totale da pagare'
  ];
  
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const row = rows[i];
    const matchCount = expectedHeaders.reduce((count, header) => {
      return count + (row.text.toLowerCase().includes(header.toLowerCase()) ? 1 : 0);
    }, 0);
    
    if (matchCount >= 3) {
      // Trovato header, costruisci le bande delle colonne
      const bands: ColumnBand[] = [];
      
      // Approccio semplificato: dividi la larghezza in 5 colonne uniformi
      // In un caso reale, cercheresti le posizioni X degli header
      const pageWidth = Math.max(...row.items.map(item => item.x + item.width));
      const colWidth = pageWidth / 5;
      
      bands.push({ key: 'seq', label: 'N. Modulo pagamento', xMin: 0, xMax: colWidth });
      bands.push({ key: 'due', label: 'Data scadenza', xMin: colWidth, xMax: colWidth * 2 });
      bands.push({ key: 'debito', label: 'Importo debito da pagare', xMin: colWidth * 2, xMax: colWidth * 3 });
      bands.push({ key: 'interessi', label: 'Interessi di dilazione', xMin: colWidth * 3, xMax: colWidth * 4 });
      bands.push({ key: 'totale', label: 'Totale da pagare', xMin: colWidth * 4, xMax: pageWidth });
      
      return { headerIndex: i, bands };
    }
  }
  
  return null;
}

// Estrae testo da una banda di colonna
export function extractTextFromBand(row: TextRow, band: ColumnBand): string {
  const relevantItems = row.items.filter(item => 
    item.x >= band.xMin && item.x <= band.xMax
  );
  
  return relevantItems
    .sort((a, b) => a.x - b.x)
    .map(item => item.str)
    .join(' ')
    .trim();
}

// Parser principale per text-layer
export function extractInstallmentsFromTextLayer(pages: ExtractedPageText[]): ParsedInstallment[] {
  const installments: ParsedInstallment[] = [];
  
  for (const page of pages) {
    const rows = groupByRows(page.items);
    const columnInfo = detectColumnBands(rows);
    
    if (!columnInfo) {
      console.warn('Header columns not detected on page', page.pageNumber);
      continue;
    }
    
    // Processa righe dati dopo l'header
    for (let i = columnInfo.headerIndex + 1; i < rows.length; i++) {
      const row = rows[i];
      
      // Salta righe vuote o riassuntive
      if (!row.text.trim() || row.text.toLowerCase().includes('totale complessivamente')) {
        continue;
      }
      
      try {
        const data: Record<string, string> = {};
        
        for (const band of columnInfo.bands) {
          data[band.key] = extractTextFromBand(row, band);
        }
        
        // Validazione e normalizzazione
        const seqMatch = data.seq.match(/(\d+)/);
        if (!seqMatch) continue;
        
        const seq = parseInt(seqMatch[1], 10);
        const dueRaw = data.due;
        const totaleRaw = data.totale;
        
        // Parse data
        const due_date = normalizeItalianDate(dueRaw);
        if (!due_date.match(/\d{4}-\d{2}-\d{2}/)) continue;
        
        // Parse importo totale
        const amount = parseEuro(totaleRaw);
        if (amount <= 0) continue;
        
        // Campi opzionali
        const debito = data.debito ? parseEuro(data.debito) : undefined;
        const interessi = data.interessi ? parseEuro(data.interessi) : undefined;
        
        installments.push({
          seq,
          due_date,
          amount,
          description: `N. Modulo ${seq} - ${dueRaw}`,
          debito,
          interessi,
          notes: interessi ? `Interessi di dilazione: ${data.interessi}` : undefined,
        });
        
      } catch (error) {
        console.warn('Error parsing row:', row.text, error);
      }
    }
  }
  
  return installments;
}

// Validazioni specifiche per Agenzia delle Entrate-Riscossione
export function validateAgenziaInstallments(
  installments: ParsedInstallment[], 
  expectedTotal?: number
): { valid: ParsedInstallment[], invalid: ParsedInstallment[], warnings: string[] } {
  const valid: ParsedInstallment[] = [];
  const invalid: ParsedInstallment[] = [];
  const warnings: string[] = [];
  
  // Controlla rate contigue
  const sequences = installments.map(i => i.seq).sort((a, b) => a - b);
  for (let i = 1; i < sequences.length; i++) {
    if (sequences[i] !== sequences[i-1] + 1) {
      warnings.push(`Sequenza non contigua: manca rata ${sequences[i-1] + 1}`);
    }
  }
  
  // Calcola somma totale
  const calculatedTotal = installments.reduce((sum, inst) => sum + inst.amount, 0);
  
  if (expectedTotal && Math.abs(calculatedTotal - expectedTotal) > 0.02) {
    warnings.push(`Somma rate (€${calculatedTotal.toFixed(2)}) != totale atteso (€${expectedTotal.toFixed(2)})`);
  }
  
  // Validazione singole rate
  for (const installment of installments) {
    const isValid = 
      installment.seq > 0 &&
      installment.amount > 0 &&
      installment.due_date.match(/\d{4}-\d{2}-\d{2}/) &&
      !isNaN(new Date(installment.due_date).getTime());
    
    if (isValid) {
      valid.push(installment);
    } else {
      invalid.push(installment);
    }
  }
  
  return { valid, invalid, warnings };
}