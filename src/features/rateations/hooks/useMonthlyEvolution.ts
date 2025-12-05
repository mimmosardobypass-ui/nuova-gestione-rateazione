import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type MonthlyPoint = {
  year: number;
  month: number;
  type_label: string;
  amount_cents: number;
};

export type MatrixCell = {
  year: number;
  month: number;
  total_cents: number;
  paid_cents: number;
  unpaid_cents: number;
  byType: Record<string, { total_cents: number; paid_cents: number; unpaid_cents: number }>;
};

export type MonthlyMatrix = {
  cells: Map<string, MatrixCell>;
  years: number[];
};

export type MonthlyEvolutionParams = {
  yearFrom: number;
  yearTo: number;
  groupBy?: 'due' | 'paid';
  includeDecayed?: boolean;
};

const keyOf = (y: number, m: number) => `${y}-${m}`;

export function useMonthlyEvolution(params: MonthlyEvolutionParams) {
  const { yearFrom, yearTo, groupBy = 'due', includeDecayed = true } = params;

  const [allPoints, setAllPoints] = useState<MonthlyPoint[]>([]);
  const [paidPoints, setPaidPoints] = useState<MonthlyPoint[]>([]);
  const [unpaidPoints, setUnpaidPoints] = useState<MonthlyPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [allRes, paidRes, unpaidRes] = await Promise.all([
        supabase.rpc("residual_evolution_by_type", {
          p_year_from: yearFrom,
          p_year_to: yearTo,
          p_pay_filter: "all",
          p_group_by: groupBy,
          p_include_decayed: includeDecayed,
        }),
        supabase.rpc("residual_evolution_by_type", {
          p_year_from: yearFrom,
          p_year_to: yearTo,
          p_pay_filter: "paid",
          p_group_by: groupBy,
          p_include_decayed: includeDecayed,
        }),
        supabase.rpc("residual_evolution_by_type", {
          p_year_from: yearFrom,
          p_year_to: yearTo,
          p_pay_filter: "unpaid",
          p_group_by: groupBy,
          p_include_decayed: includeDecayed,
        }),
      ]);

      if (allRes.error) throw new Error(allRes.error.message);
      if (paidRes.error) throw new Error(paidRes.error.message);
      if (unpaidRes.error) throw new Error(unpaidRes.error.message);

      setAllPoints((allRes.data as any[]) || []);
      setPaidPoints((paidRes.data as any[]) || []);
      setUnpaidPoints((unpaidRes.data as any[]) || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore caricamento dati");
    } finally {
      setLoading(false);
    }
  }, [yearFrom, yearTo, groupBy, includeDecayed]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const matrix: MonthlyMatrix = useMemo(() => {
    const cells = new Map<string, MatrixCell>();
    const years = new Set<number>();

    const ensure = (y: number, m: number) => {
      const k = keyOf(y, m);
      let c = cells.get(k);
      if (!c) {
        c = {
          year: y,
          month: m,
          total_cents: 0,
          paid_cents: 0,
          unpaid_cents: 0,
          byType: {},
        };
        cells.set(k, c);
      }
      years.add(y);
      return c;
    };

    // Totale dovuto
    for (const p of allPoints) {
      const c = ensure(p.year, p.month);
      c.total_cents += p.amount_cents;
      if (!c.byType[p.type_label]) {
        c.byType[p.type_label] = { total_cents: 0, paid_cents: 0, unpaid_cents: 0 };
      }
      c.byType[p.type_label].total_cents += p.amount_cents;
    }

    // Pagato
    for (const p of paidPoints) {
      const c = ensure(p.year, p.month);
      c.paid_cents += p.amount_cents;
      if (!c.byType[p.type_label]) {
        c.byType[p.type_label] = { total_cents: 0, paid_cents: 0, unpaid_cents: 0 };
      }
      c.byType[p.type_label].paid_cents += p.amount_cents;
    }

    // Non pagato
    for (const p of unpaidPoints) {
      const c = ensure(p.year, p.month);
      c.unpaid_cents += p.amount_cents;
      if (!c.byType[p.type_label]) {
        c.byType[p.type_label] = { total_cents: 0, paid_cents: 0, unpaid_cents: 0 };
      }
      c.byType[p.type_label].unpaid_cents += p.amount_cents;
    }

    return { cells, years: Array.from(years).sort((a, b) => b - a) };
  }, [allPoints, paidPoints, unpaidPoints]);

  return { loading, error, matrix };
}
