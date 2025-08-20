export type MetricType = 'due' | 'paid' | 'overdue' | 'extra_ravv';

export interface MonthlyMetric {
  year: number;
  month: number;              // 1..12
  due_amount: number;
  paid_amount: number;
  overdue_amount: number;
  extra_ravv_amount: number;
  installments_count: number;
  paid_count: number;
}

export type MatrixData = Record<number, Record<number, MonthlyMetric>>;