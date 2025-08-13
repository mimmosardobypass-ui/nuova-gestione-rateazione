import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

type Stats = { 
  total_due: number; 
  total_paid: number; 
  total_late: number; 
  total_residual: number;
  paid_count: number;
  total_count: number;
};

export function useRateationStats() {
  const [stats, setStats] = useState<Stats>({ 
    total_due: 0, 
    total_paid: 0, 
    total_late: 0, 
    total_residual: 0,
    paid_count: 0,
    total_count: 0
  });
  const [previousStats, setPreviousStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    // Keep previous stats visible during reload for short caching
    if (stats.total_due > 0) {
      setPreviousStats(stats);
    }
    setLoading(true); 
    setError(null);
    
    try {
      // Get current user first
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Fetch all rateations for the user
      const { data: rateations } = await supabase
        .from("rateations")
        .select("id, total_amount")
        .eq("owner_uid", user.id);

      const rateationIds = (rateations ?? []).map(x => x.id);
      
      let paid = 0;
      let late = 0;
      let paidCount = 0;
      let totalCount = 0;
      
      if (rateationIds.length > 0) {
        // Fetch all installments for these rateations
        const { data: installments } = await supabase
          .from("installments")
          .select("amount, is_paid, due_date")
          .in("rateation_id", rateationIds);

        // Use normalized Date objects for timezone-safe comparison
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Normalize to start of day
        
        for (const inst of (installments ?? [])) {
          const amount = Number(inst.amount || 0);
          totalCount++;
          
          if (inst.is_paid) {
            paid += amount;
            paidCount++;
          }
          
          if (!inst.is_paid && inst.due_date) {
            const dueDate = new Date(inst.due_date);
            dueDate.setHours(0, 0, 0, 0); // Normalize to start of day
            if (dueDate < today) {
              late += amount;
            }
          }
        }
      }
      
      const total = (rateations ?? []).reduce((sum, r) => sum + Number(r.total_amount || 0), 0);
      
      setStats({ 
        total_due: total, 
        total_paid: paid, 
        total_late: late, 
        total_residual: Math.max(0, total - paid),
        paid_count: paidCount,
        total_count: totalCount
      });
    } catch (e: any) {
      console.error("[KPI]", e);
      setError(e.message || "Errore nel caricamento statistiche");
      setStats({ 
        total_due: 0, 
        total_paid: 0, 
        total_late: 0, 
        total_residual: 0,
        paid_count: 0,
        total_count: 0
      });
    } finally {
      setLoading(false);
      setPreviousStats(null); // Clear previous stats after loading
    }
  }, []);

  useEffect(() => { 
    load(); 
  }, [load]);

  return { stats, previousStats, loading, error, reload: load };
}