export type PayFilterType = 'unpaid' | 'paid' | 'all';

export interface MonthlyMetricByType {
  year: number;
  month: number;
  type_label: string;
  due_amount_cents: number;
  paid_amount_cents: number;
  overdue_amount_cents: number;
  extra_ravv_amount_cents: number;
  installments_count: number;
  paid_count: number;
}

export interface MatrixByTypeFilters {
  payFilter: PayFilterType;
  typeFilter: string[];
  yearFilter: number | null;
}

export interface TypeMonthlyData {
  [month: number]: number;
}

export interface YearMonthlyData {
  [type: string]: TypeMonthlyData;
  totals: TypeMonthlyData;
  progressive: TypeMonthlyData;
}

export interface MatrixByTypeData {
  [year: number]: YearMonthlyData;
}
