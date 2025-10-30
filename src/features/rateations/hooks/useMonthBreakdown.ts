import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type BreakdownRow = {
  type: string;
  paid_cents: number;
  unpaid_cents: number;
  total_cents: number;
  paid_pct: number;
};

export type MonthKpis = {
  due_cents: number;
  paid_cents: number;
  unpaid_cents: number;
  paid_pct: number;
  unpaid_pct: number;
};

export function useMonthBreakdown(year: number | null, month: number | null) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<BreakdownRow[]>([]);
  const [kpis, setKpis] = useState<MonthKpis | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!year || !month) return;

    try {
      setLoading(true);
      setError(null);

      const [paidRes, unpaidRes] = await Promise.all([
        supabase.rpc("residual_evolution_by_type", {
          p_year_from: year,
          p_year_to: year,
          p_pay_filter: "paid",
        }),
        supabase.rpc("residual_evolution_by_type", {
          p_year_from: year,
          p_year_to: year,
          p_pay_filter: "unpaid",
        }),
      ]);

      if (paidRes.error) throw new Error(paidRes.error.message);
      if (unpaidRes.error) throw new Error(unpaidRes.error.message);

      // Filtra il mese selezionato
      const paid = ((paidRes.data as any[]) || []).filter((r) => r.month === month);
      const unpaid = ((unpaidRes.data as any[]) || []).filter((r) => r.month === month);

      const byType = new Map<
        string,
        { paid_cents: number; unpaid_cents: number; total_cents: number }
      >();
      let paidSum = 0;
      let unpaidSum = 0;
      let totalDue = 0;

      for (const r of paid) {
        const b = byType.get(r.type_label) || { paid_cents: 0, unpaid_cents: 0, total_cents: 0 };
        b.paid_cents += r.amount_cents;
        b.total_cents += r.amount_cents;
        byType.set(r.type_label, b);
        paidSum += r.amount_cents;
        totalDue += r.amount_cents;
      }

      for (const r of unpaid) {
        const b = byType.get(r.type_label) || { paid_cents: 0, unpaid_cents: 0, total_cents: 0 };
        b.unpaid_cents += r.amount_cents;
        b.total_cents += r.amount_cents;
        byType.set(r.type_label, b);
        unpaidSum += r.amount_cents;
        totalDue += r.amount_cents;
      }

      const rowsArr: BreakdownRow[] = Array.from(byType.entries())
        .map(([type, v]) => ({
          type,
          paid_cents: v.paid_cents,
          unpaid_cents: v.unpaid_cents,
          total_cents: v.total_cents,
          paid_pct: v.total_cents ? v.paid_cents / v.total_cents : 0,
        }))
        .sort((a, b) => b.total_cents - a.total_cents);

      const k: MonthKpis = {
        due_cents: totalDue,
        paid_cents: paidSum,
        unpaid_cents: unpaidSum,
        paid_pct: totalDue ? paidSum / totalDue : 0,
        unpaid_pct: totalDue ? unpaidSum / totalDue : 0,
      };

      setRows(rowsArr);
      setKpis(k);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore caricamento dettaglio");
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { loading, error, rows, kpis };
}
