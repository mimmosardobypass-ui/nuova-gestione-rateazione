/**
 * Types for Residual Evolution Dashboard (V2)
 * Matrix view with months as rows, years as columns, expandable by type
 */

export type PayFilterType = 'unpaid' | 'paid' | 'all';

export type RateationType = 'F24' | 'PagoPa' | 'Rottamazione Quater' | 'Riam. Quater';

export interface ResidualEvolutionFilters {
  yearFrom: number;
  yearTo: number;
  payFilter: PayFilterType;
  selectedTypes: RateationType[];
}

export interface MonthlyResidualData {
  [type: string]: number; // cents per type
  total: number; // total cents for the month
}

export interface YearData {
  [month: number]: MonthlyResidualData; // 1..12
  progressive: { [month: number]: number }; // cumulative sum in cents
  totalYear: number; // sum of all 12 months (cents)
  averageMonth: number; // totalYear / 12 (cents)
}

export interface ResidualEvolutionData {
  [year: number]: YearData;
}

export interface KPIData {
  totalPeriod: number; // cents
  averageMonth: number; // cents (average across all months in period)
  peakMonth: number; // cents (highest monthly total)
  activeMonths: number; // count of months with amount > 0
}

export const MONTH_NAMES = [
  'Gennaio',
  'Febbraio',
  'Marzo',
  'Aprile',
  'Maggio',
  'Giugno',
  'Luglio',
  'Agosto',
  'Settembre',
  'Ottobre',
  'Novembre',
  'Dicembre',
];

export const TYPE_COLORS: Record<RateationType, string> = {
  F24: 'hsl(var(--chart-1))',
  PagoPa: 'hsl(var(--chart-2))',
  'Rottamazione Quater': 'hsl(var(--chart-3))',
  'Riam. Quater': 'hsl(var(--chart-4))',
};
