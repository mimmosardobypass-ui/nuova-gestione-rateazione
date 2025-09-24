import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logHealthViolation } from "@/utils/observability";

export interface RateationsHealthData {
  suspicious: number;
  totalRows: number;
  loading: boolean;
}

/**
 * Health check hook for rateations data consistency
 * Detects suspicious rows where installments_paid > 0 but paid_amount_cents = 0
 */
export function useRateationsHealth(): RateationsHealthData {
  const [health, setHealth] = useState<RateationsHealthData>({
    suspicious: 0,
    totalRows: 0,
    loading: true,
  });

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          setHealth({ suspicious: 0, totalRows: 0, loading: false });
          return;
        }

        const { data, error } = await supabase
          .from("v_rateations_list_ui")
          .select("installments_paid, paid_amount_cents")
          .eq("owner_uid", session.user.id);

        if (error) {
          console.warn("[useRateationsHealth] Query error:", error);
          setHealth({ suspicious: 0, totalRows: 0, loading: false });
          return;
        }

        const rows = data ?? [];
        const suspiciousRows = rows.filter(
          (r: any) => (r.installments_paid ?? 0) > 0 && (r.paid_amount_cents ?? 0) === 0
        );

        setHealth({
          suspicious: suspiciousRows.length,
          totalRows: rows.length,
          loading: false,
        });

        // Log health violations for observability
        if (suspiciousRows.length > 0) {
          logHealthViolation(suspiciousRows.length, rows.length, session.user.id);
        }
      } catch (err) {
        console.warn("[useRateationsHealth] Unexpected error:", err);
        setHealth({ suspicious: 0, totalRows: 0, loading: false });
      }
    };

    checkHealth();
  }, []);

  return health;
}