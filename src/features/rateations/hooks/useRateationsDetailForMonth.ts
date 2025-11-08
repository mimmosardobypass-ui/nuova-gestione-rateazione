import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type RateationDetail = {
  id: number;
  number: string;
  taxpayer_name: string | null;
  amount_cents: number;
  residual_cents: number;
  is_paid: boolean;
};

export function useRateationsDetailForMonth(
  year: number | null,
  month: number | null,
  typeLabel: string | null,
  groupBy: 'due' | 'paid' = 'due'
) {
  const [loading, setLoading] = useState(false);
  const [paid, setPaid] = useState<RateationDetail[]>([]);
  const [unpaid, setUnpaid] = useState<RateationDetail[]>([]);

  useEffect(() => {
    if (!year || !month || !typeLabel) {
      setPaid([]);
      setUnpaid([]);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        // Costruisci il range del mese
        const dateFrom = `${year}-${String(month).padStart(2, "0")}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const dateTo = `${year}-${String(month).padStart(2, "0")}-${lastDay}`;

        // Query installments nel mese - filtra per data scadenza o pagamento
        let query = supabase
          .from("installments")
          .select("rateation_id, amount_cents, is_paid, paid_date, paid_at");

        if (groupBy === 'paid') {
          // Modalità "Per Pagamento": filtra per paid_date/paid_at e solo rate pagate
          query = query
            .eq("is_paid", true)
            .or(`and(paid_date.gte.${dateFrom},paid_date.lte.${dateTo}),and(paid_at.gte.${dateFrom},paid_at.lte.${dateTo})`);
        } else {
          // Modalità "Per Scadenza" (default): filtra per due_date
          query = query
            .gte("due_date", dateFrom)
            .lte("due_date", dateTo);
        }

        const { data: installments, error: instError } = await query;

        if (instError) throw instError;

        // Raggruppa per rateation_id
        const byRateation = new Map<number, { total: number; residual: number; hasPaid: boolean; hasUnpaid: boolean }>();
        
        (installments || []).forEach((inst) => {
          const ratId = inst.rateation_id;
          if (!ratId) return;
          
          const existing = byRateation.get(ratId) || { total: 0, residual: 0, hasPaid: false, hasUnpaid: false };
          existing.total += inst.amount_cents || 0;
          
          if (inst.is_paid) {
            existing.hasPaid = true;
          } else {
            existing.residual += inst.amount_cents || 0;
            existing.hasUnpaid = true;
          }
          
          byRateation.set(ratId, existing);
        });

        // Ottieni le rateazioni dalla vista
        const rateationIds = Array.from(byRateation.keys());
        if (rateationIds.length === 0) {
          setPaid([]);
          setUnpaid([]);
          setLoading(false);
          return;
        }

        // Query 1: Ottieni le rateazioni base (escludi INTERROTTA)
        const { data: rateations, error: ratError } = await supabase
          .from("v_rateations_with_kpis")
          .select("*")
          .in("id", rateationIds)
          .neq("status", "INTERROTTA");

        if (ratError) throw ratError;

        // Query 2: Ottieni i type_label per queste rateazioni
        const { data: typeLabels, error: typeError } = await supabase
          .from("v_rateation_type_label")
          .select("id, type_label")
          .in("id", rateationIds);

        if (typeError) throw typeError;

        // Crea una Map per lookup rapido: rateation_id -> type_label
        const typeLabelMap = new Map<number, string>();
        (typeLabels || []).forEach((tl: any) => {
          typeLabelMap.set(tl.id, tl.type_label);
        });

        // Filtra per tipo usando la Map
        const filteredRateations = (rateations || []).filter((r: any) => {
          const rateationType = typeLabelMap.get(r.id);
          return rateationType === typeLabel;
        });

        const paidList: RateationDetail[] = [];
        const unpaidList: RateationDetail[] = [];

        filteredRateations.forEach((rat: any) => {
          const stats = byRateation.get(rat.id);
          if (!stats) return;

          const detail: RateationDetail = {
            id: rat.id,
            number: rat.number || "",
            taxpayer_name: rat.taxpayer_name,
            amount_cents: stats.total,
            residual_cents: stats.residual,
            is_paid: stats.residual === 0,
          };

          if (stats.hasUnpaid) {
            unpaidList.push(detail);
          }
          if (stats.hasPaid && stats.residual === 0) {
            paidList.push(detail);
          }
        });

        setPaid(paidList);
        setUnpaid(unpaidList);
      } catch (e) {
        console.error("Error fetching rateations detail:", e);
        setPaid([]);
        setUnpaid([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [year, month, typeLabel, groupBy]);

  return { loading, paid, unpaid };
}
