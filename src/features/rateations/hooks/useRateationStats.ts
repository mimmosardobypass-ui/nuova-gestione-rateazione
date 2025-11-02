import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client-resilient";
import { fetchResidualEuro, fetchOverdueEffectiveEuro } from "@/features/rateations/api/kpi";

type Stats = { 
  total_due: number; 
  total_paid: number; 
  total_late: number; 
  total_residual: number;
  paid_count: number;
  total_count: number;
  series: {
    last12: {
      months: string[];
      paid: number[];
      due: number[];
      residual: number[];
      late: number[];
    };
  };
};

export function useRateationStats() {
  const [stats, setStats] = useState<Stats>({ 
    total_due: 0, 
    total_paid: 0, 
    total_late: 0, 
    total_residual: 0,
    paid_count: 0,
    total_count: 0,
    series: {
      last12: {
        months: [],
        paid: [],
        due: [],
        residual: [],
        late: []
      }
    }
  });
  const [previousStats, setPreviousStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    // Keep previous stats visible during reload for short caching
    if (stats.total_due > 0) {
      setPreviousStats(stats);
    }
    
    const controller = new AbortController();
    setLoading(true); 
    setError(null);
    
    try {
      // Get current user first
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      if (controller.signal.aborted) return;

      // Fetch all rateations for the user with full data for filtering
      const { data: rateations } = await supabase
        .from("rateations")
        .select("id, total_amount, status, is_f24, residual_amount_cents, paid_amount_cents")
        .eq("owner_uid", user.id)
        .eq("is_deleted", false);

      if (controller.signal.aborted) return;

      // Filter rateations exactly like the table does (active + pending decayed F24)
      const activeRateations = (rateations ?? []).filter(r => {
        const status = r.status?.toUpperCase();
        const residualCents = r.residual_amount_cents ?? 0;
        
        // CASO A: Rateazioni ATTIVE (PagoPA, F24, RQ in corso)
        const isActive = residualCents > 0 && 
                         status !== 'COMPLETATA' && 
                         status !== 'DECADUTA' && 
                         status !== 'ESTINTA' &&
                         status !== 'INTERROTTA';
        
        // CASO B: F24 DECADUTE in attesa di cartella (non ancora agganciate)
        const isPendingDecayed = r.is_f24 && 
                                 status === 'DECADUTA' &&
                                 residualCents > 0;
        
        return isActive || isPendingDecayed;
      });

      const rateationIds = activeRateations.map(x => x.id);
      
      // Calculate total_paid from DB (sum of paid_amount_cents from filtered rateations)
      const totalPaid = activeRateations.reduce((sum, r) => {
        return sum + ((r.paid_amount_cents ?? 0) / 100);
      }, 0);
      
      // Generate last 12 months (from 11 months ago to current month)
      const last12Months: string[] = [];
      const monthlyPaid: number[] = [];
      const monthlyDue: number[] = [];
      const monthlyResidual: number[] = [];
      const monthlyLate: number[] = [];
      
      if (rateationIds.length > 0) {
        // Fetch all installments for these rateations (only for series calculation)
        const { data: installments } = await supabase
          .from("installments")
          .select("amount, is_paid, due_date, paid_at")
          .in("rateation_id", rateationIds);

        if (controller.signal.aborted) return;
        
        // Use normalized Date objects for timezone-safe comparison
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Normalize to start of day
        
        for (let i = 11; i >= 0; i--) {
          const monthDate = new Date();
          monthDate.setMonth(monthDate.getMonth() - i);
          monthDate.setDate(1);
          monthDate.setHours(0, 0, 0, 0);
          
          const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
          last12Months.push(monthKey);
          
          // Calculate next month start for range
          const nextMonth = new Date(monthDate);
          nextMonth.setMonth(nextMonth.getMonth() + 1);
          
          let monthPaid = 0;
          let monthDue = 0;
          let monthLate = 0;
          
          for (const inst of (installments ?? [])) {
            const amount = Number(inst.amount || 0);
            
            // For paid amounts, use paid_at if available, fallback to due_date
            if (inst.is_paid) {
              const paidDate = new Date(inst.paid_at || inst.due_date);
              paidDate.setHours(0, 0, 0, 0);
              
              if (paidDate >= monthDate && paidDate < nextMonth) {
                monthPaid += amount;
              }
            }
            
            // For due amounts, always use due_date
            if (inst.due_date) {
              const dueDate = new Date(inst.due_date);
              dueDate.setHours(0, 0, 0, 0);
              
              if (dueDate >= monthDate && dueDate < nextMonth) {
                monthDue += amount;
                
                // Check if it's late (not paid and due date is past, OR paid late)
                if (!inst.is_paid && dueDate < today) {
                  monthLate += amount;
                } else if (inst.is_paid && inst.paid_at) {
                  const paidDate = new Date(inst.paid_at);
                  paidDate.setHours(0, 0, 0, 0);
                  if (paidDate > dueDate) {
                    monthLate += amount;
                  }
                }
              }
            }
          }
          
          monthlyPaid.push(monthPaid);
          monthlyDue.push(monthDue);
          monthlyResidual.push(Math.max(0, monthDue - monthPaid));
          monthlyLate.push(monthLate);
        }
      }
      
      // Use DB views for effective KPIs (excludes interrupted PagoPA)
      const residualEuro = await fetchResidualEuro(controller.signal);
      const overdueEuro = await fetchOverdueEffectiveEuro(controller.signal);
      
      if (controller.signal.aborted) return;
      
      // Calculate total_due as paid + residual for coherence with DB
      const totalDue = totalPaid + residualEuro;
      
      setStats({ 
        total_due: totalDue, 
        total_paid: totalPaid, 
        total_late: overdueEuro, 
        total_residual: residualEuro,
        paid_count: 0, // Not used in UI
        total_count: rateationIds.length,
        series: {
          last12: {
            months: last12Months,
            paid: monthlyPaid,
            due: monthlyDue,
            residual: monthlyResidual,
            late: monthlyLate
          }
        }
      });
    } catch (e: any) {
      if (controller.signal.aborted || (e instanceof Error && e.message === 'AbortError')) {
        console.debug('[ABORT] useRateationStats load');
        return;
      }
      console.error("[KPI]", e);
      setError(e.message || "Errore nel caricamento statistiche");
      setStats({ 
        total_due: 0, 
        total_paid: 0, 
        total_late: 0, 
        total_residual: 0,
        paid_count: 0,
        total_count: 0,
        series: {
          last12: {
            months: [],
            paid: [],
            due: [],
            residual: [],
            late: []
          }
        }
      });
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
        setPreviousStats(null); // Clear previous stats after loading
      }
    }
    
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const cleanup = load();
    return () => {
      if (cleanup instanceof Function) cleanup();
    };
  }, [load]);

  return { stats, previousStats, loading, error, reload: load };
}