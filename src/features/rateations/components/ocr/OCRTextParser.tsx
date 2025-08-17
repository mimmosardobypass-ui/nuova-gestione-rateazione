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

export class OCRTextParser {
  private static defaultProfile: ParsingProfile = {
    name: 'Piano di Ammortamento Standard',
    columnMappings: {
      seqPattern: '(\\d+)\\s*°?\\s*rata',
      datePattern: '(\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4})',
      amountPattern: '€?\\s*(\\d{1,3}(?:\\.\\d{3})*(?:,\\d{2})?)',
      descriptionPattern: '(IMU|TASI|TARI|IRPEF|IRES|IVA|[A-Z]{2,})',
      tributoPattern: '(IMU|TASI|TARI|IRPEF|IRES|IVA)',
      annoPattern: '(20\\d{2})',
      debitoPattern: 'Debito[\\s:]*€?\\s*(\\d{1,3}(?:\\.\\d{3})*(?:,\\d{2})?)',
      interessiPattern: 'Interessi[\\s:]*€?\\s*(\\d{1,3}(?:\\.\\d{3})*(?:,\\d{2})?)',
    }
  };

  static parseOCRText(text: string, profile: ParsingProfile = this.defaultProfile): ParsedInstallment[] {
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
      // Extract sequence number
      const seqMatch = profile.columnMappings.seqPattern 
        ? new RegExp(profile.columnMappings.seqPattern, 'i').exec(line)
        : null;
      const seq = seqMatch ? parseInt(seqMatch[1]) : fallbackSeq;

      // Extract date
      const dateMatch = profile.columnMappings.datePattern
        ? new RegExp(profile.columnMappings.datePattern).exec(line)
        : null;
      
      if (!dateMatch) return null; // Skip lines without dates

      const due_date = this.normalizeDate(dateMatch[1]);

      // Extract amount
      const amountMatch = profile.columnMappings.amountPattern
        ? new RegExp(profile.columnMappings.amountPattern).exec(line)
        : null;
      
      if (!amountMatch) return null; // Skip lines without amounts

      const amount = this.parseAmount(amountMatch[1]);

      // Extract other fields
      const tributoMatch = profile.columnMappings.tributoPattern
        ? new RegExp(profile.columnMappings.tributoPattern, 'i').exec(line)
        : null;
      
      const annoMatch = profile.columnMappings.annoPattern
        ? new RegExp(profile.columnMappings.annoPattern).exec(line)
        : null;

      const debitoMatch = profile.columnMappings.debitoPattern
        ? new RegExp(profile.columnMappings.debitoPattern, 'i').exec(line)
        : null;

      const interessiMatch = profile.columnMappings.interessiPattern
        ? new RegExp(profile.columnMappings.interessiPattern, 'i').exec(line)
        : null;

      return {
        seq,
        due_date,
        amount,
        description: line,
        tributo: tributoMatch?.[1],
        anno: annoMatch?.[1],
        debito: debitoMatch ? this.parseAmount(debitoMatch[1]) : undefined,
        interessi: interessiMatch ? this.parseAmount(interessiMatch[1]) : undefined,
        notes: `Estratto da OCR: ${line}`,
      };
    } catch (error) {
      console.warn('Error parsing line:', line, error);
      return null;
    }
  }

  private static normalizeDate(dateStr: string): string {
    // Convert various date formats to ISO (YYYY-MM-DD)
    const cleanDate = dateStr.replace(/[^\d/-]/g, '');
    const parts = cleanDate.split(/[/-]/);
    
    if (parts.length === 3) {
      let [day, month, year] = parts;
      
      // Handle 2-digit years
      if (year.length === 2) {
        year = '20' + year;
      }
      
      // Ensure proper formatting
      day = day.padStart(2, '0');
      month = month.padStart(2, '0');
      
      return `${year}-${month}-${day}`;
    }
    
    return dateStr; // Return original if parsing fails
  }

  private static parseAmount(amountStr: string): number {
    // Remove currency symbols and normalize decimal separators
    const cleanAmount = amountStr
      .replace(/[€$£]/g, '')
      .replace(/\./g, '') // Remove thousands separators
      .replace(/,/, '.') // Convert decimal separator
      .trim();
    
    return parseFloat(cleanAmount) || 0;
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