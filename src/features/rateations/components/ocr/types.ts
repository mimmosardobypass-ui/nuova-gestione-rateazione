// Shared types for OCR components

export interface ParsedInstallment {
  seq: number;
  due_date: string;         // ISO yyyy-mm-dd
  amount: number;
  description: string;
  anno?: string;
  notes?: string;
  tributo?: string;
  debito?: number;
  interessi?: number;
}

export interface ParsingProfile {
  id: string;
  name: string;
  columnMappings: {
    seq?: string;
    due_date?: string;
    amount?: string;
    description?: string;
    tributo?: string;
    anno?: string;
    debito?: number;
    interessi?: number;
    // Additional patterns for advanced parsing
    seqPattern?: string;
    datePattern?: string;
    amountPattern?: string;
    debitoPattern?: string;
    interessiPattern?: string;
  };
}