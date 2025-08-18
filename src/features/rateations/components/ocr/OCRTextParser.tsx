import { parseItalianDateToISO } from '@/utils/date';
import { AgenziaRiscossioneProfile, detectAgenziaRiscossione } from './profiles/AgenziaRiscossioneProfile';

export interface ParsedInstallment {
  seq: number;
  due_date: string;
  amount: number;
  description: string;
  tributo?: string;
  anno?: string;
  debito?: number;
  interessi?: number;
  notes?: string;
}

export interface ParsingProfile {
  id?: string;
  name: string;
  columnMappings: {
    seqPattern?: string;
    datePattern?: string;
    amountPattern?: string;
    descriptionPattern?: string;
    tributoPattern?: string;
    annoPattern?: string;
    debitoPattern?: string;
    interessiPattern?: string;
  };
}

// Profili disponibili
export const PARSING_PROFILES = [
  AgenziaRiscossioneProfile,
] as const;

export class OCRTextParser {
  // Regex migliorate per formato commercialista
  private static readonly IT_AMOUNT_REGEX = /\b\d{1,3}(?:\.\d{3})*,\d{2}\b/g;
  private static readonly EN_AMOUNT_REGEX = /\b\d+\.\d{2}\b/g;
  private static readonly DATE_REGEX = /\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\b/;
  private static readonly SEQ_REGEX = /^\s*(\d+)\s+/;

  private static defaultProfile: ParsingProfile = {
    name: 'Piano di Ammortamento Standard',
    columnMappings: {
      seqPattern: '^\\s*(\\d+)\\s+',
      datePattern: '\\b(\\d{1,2})[/.-](\\d{1,2})[/.-](\\d{2,4})\\b',
      amountPattern: '\\b\\d{1,3}(?:\\.\\d{3})*,\\d{2}\\b',
      descriptionPattern: '(IMU|TASI|TARI|IRPEF|IRES|IVA|[A-Z]{2,})',
      tributoPattern: '(IMU|TASI|TARI|IRPEF|IRES|IVA)',
      annoPattern: '(20\\d{2})',
      debitoPattern: 'Debito[\\s:]*€?\\s*(\\d{1,3}(?:\\.\\d{3})*(?:,\\d{2})?)',
      interessiPattern: 'Interessi[\\s:]*€?\\s*(\\d{1,3}(?:\\.\\d{3})*(?:,\\d{2})?)',
    }
  };

  static parseOCRText(text: string, profile?: ParsingProfile): ParsedInstallment[] {
    // Auto-detect profile if not provided
    const selectedProfile = profile || this.detectProfile(text);
    
    return this.parseWithProfile(text, selectedProfile);
  }

  static detectProfile(text: string): ParsingProfile {
    // Try to detect Agenzia Riscossione format
    if (detectAgenziaRiscossione(text)) {
      return AgenziaRiscossioneProfile;
    }
    
    // Fallback to default profile
    return this.defaultProfile;
  }

  private static parseWithProfile(text: string, profile: ParsingProfile): ParsedInstallment[] {
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    const installments: ParsedInstallment[] = [];

    let currentSeq = 1;

    for (const line of lines) {
      const cleanLine = line.trim();
      
      // Skip headers and empty lines
      if (this.isHeaderLine(cleanLine)) continue;

      const installment = this.parseLine(cleanLine, profile, currentSeq);
      if (installment) {
        installments.push(installment);
        currentSeq++;
      }
    }

    return installments;
  }

  private static isHeaderLine(line: string): boolean {
    const l = line.toLowerCase().trim();
    if (!l) return true;
    
    // Scarta intestazioni e righe riassuntive
    if (/(piano di ammortamento|rata\s*data|descrizione|interessi|da versare|azienda|data di stampa)/i.test(l)) return true;
    
    // Scarta righe troppo corte
    if (l.length < 10) return true;
    
    const headerPatterns = [
      /^(rata|scadenza|importo|data|descrizione|tributo|anno)/i,
      /^(n°|num|numero)/i,
      /^(piano|ammortamento)/i,
      /^[-=]+$/,
    ];

    return headerPatterns.some(pattern => pattern.test(line));
  }

  private static parseLine(line: string, profile: ParsingProfile, fallbackSeq: number): ParsedInstallment | null {
    try {
      const text = line.replace(/\s+/g, ' ').trim();
      if (!text) return null;

      // 1) Numero progressivo all'inizio riga
      const seqMatch = this.SEQ_REGEX.exec(text);
      const seq = seqMatch ? parseInt(seqMatch[1], 10) : fallbackSeq;

      // 2) Prima DATA dopo il progressivo => scadenza
      const dateISO = parseItalianDateToISO(text) || 
        (this.DATE_REGEX.exec(text) ? parseItalianDateToISO(this.DATE_REGEX.exec(text)![0]) : null);
      if (!dateISO) return null; // se non abbiamo data, saltiamo la riga
      const due_date = dateISO;

      // 3) IMPORTO: prendiamo SEMPRE l'ULTIMO importo con 2 decimali della riga
      // prima in stile IT (1.767,70), se non c'è proviamo stile EN (1767.70)
      let amounts: string[] = text.match(this.IT_AMOUNT_REGEX) || [];
      if (amounts.length === 0) {
        amounts = text.match(this.EN_AMOUNT_REGEX) || [];
      }
      if (amounts.length === 0) {
        // nessun importo con decimali → riga non valida per noi
        return null;
      }
      const amountStr = amounts[amounts.length - 1]; // ULTIMO = "Da versare"
      const amount = this.parseAmountSmart(amountStr);

      // 4) Campi facoltativi
      // Anno derivato dalla scadenza
      const anno = due_date.slice(0, 4);

      // Tributo e altri campi opzionali (manteniamo le regex esistenti)
      const tributoMatch = profile.columnMappings.tributoPattern
        ? new RegExp(profile.columnMappings.tributoPattern, 'i').exec(text)
        : null;

      const debitoMatch = profile.columnMappings.debitoPattern
        ? new RegExp(profile.columnMappings.debitoPattern, 'i').exec(text)
        : null;

      const interessiMatch = profile.columnMappings.interessiPattern
        ? new RegExp(profile.columnMappings.interessiPattern, 'i').exec(text)
        : null;

      return {
        seq,
        due_date,
        amount,
        description: text,
        tributo: tributoMatch?.[1],
        anno,
        debito: debitoMatch ? this.parseAmountSmart(debitoMatch[1]) : undefined,
        interessi: interessiMatch ? this.parseAmountSmart(interessiMatch[1]) : undefined,
        notes: `Estratto da OCR`,
      };
    } catch (error) {
      console.warn('Error parsing line:', line, error);
      return null;
    }
  }

  // Rimosso: normalizeDate sostituito da parseItalianDateToISO

  private static parseAmount(amountStr: string): number {
    // Remove currency symbols and normalize decimal separators
    const cleanAmount = amountStr
      .replace(/[€$£]/g, '')
      .replace(/\./g, '') // Remove thousands separators
      .replace(/,/, '.') // Convert decimal separator
      .trim();
    
    return parseFloat(cleanAmount) || 0;
  }

  private static parseAmountSmart(raw: string): number {
    if (!raw) return 0;
    
    // Rimuove spazi e simboli
    let s = raw.replace(/[^\d.,]/g, '');

    // Se contiene sia '.' che ',' => stile IT: '.' migliaia, ',' decimale
    if (s.includes('.') && s.includes(',')) {
      s = s.replace(/\./g, '').replace(',', '.');
      return parseFloat(s) || 0;
    }
    // Solo virgola => probabile stile IT
    if (s.includes(',')) {
      s = s.replace(/\./g, '').replace(',', '.');
      return parseFloat(s) || 0;
    }
    // Solo punto => probabile stile EN
    return parseFloat(s) || 0;
  }

  static validateInstallments(installments: ParsedInstallment[]): { valid: ParsedInstallment[], invalid: ParsedInstallment[] } {
    const valid: ParsedInstallment[] = [];
    const invalid: ParsedInstallment[] = [];

    for (const installment of installments) {
      const isValid = 
        installment.seq > 0 &&
        installment.amount > 0 &&
        this.isValidDate(installment.due_date);

      if (isValid) {
        valid.push(installment);
      } else {
        invalid.push(installment);
      }
    }

    return { valid, invalid };
  }

  private static isValidDate(dateStr: string): boolean {
    const date = new Date(dateStr);
    return !isNaN(date.getTime());
  }
}