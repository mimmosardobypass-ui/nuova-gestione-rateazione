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
  typeLabel: string | null
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

        // Query installments nel mese
        const { data: installments, error: instError } = await supabase
          .from("installments")
          .select("rateation_id, amount_cents, is_paid")
          .gte("due_date", dateFrom)
          .lte("due_date", dateTo);

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

        const { data: rateations, error: ratError } = await supabase
          .from("v_rateations_with_kpis")
          .select("*")
          .in("id", rateationIds) as any;

        if (ratError) throw ratError;

        // Filtra per tipo
        const filteredRateations = (rateations || []).filter((r: any) => r.tipo === typeLabel);

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
  }, [year, month, typeLabel]);

  return { loading, paid, unpaid };
}
