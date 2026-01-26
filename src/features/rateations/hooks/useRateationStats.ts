import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client-resilient";
import { 
  fetchDueByType,
  fetchPaidByType,
  fetchResidualByType,
  fetchOverdueByType,
  type KpiBreakdown
} from "@/features/rateations/api/kpi";

// Category constants matching card footer logic
// F24 Card: Dovuto/Residuo = solo Attive, Pagato = Attive + Completate
const F24_ACTIVE = ['F24'];
const F24_PAID = ['F24', 'F24 Completate'];

// PagoPA Card: Dovuto/Residuo = solo Attive, Pagato = Attive + Completate
const PAGOPA_ACTIVE = ['PagoPa'];
const PAGOPA_PAID = ['PagoPa', 'PagoPA Completate'];

// Rottamazioni Card: sempre tutte le categorie
const ROTTAMAZIONI_TYPES = ['Rottamazione Quater', 'Riam. Quater', 'Rottamazione Quinquies'];

// Helper: sum breakdown values for specified types (in cents)
function sumBreakdownByTypes(breakdown: KpiBreakdown, types: string[]): number {
  return types.reduce((sum, type) => {
    const found = breakdown.find(b => b.type_label === type);
    return sum + (found?.amount_cents ?? 0);
  }, 0);
}

// Helper: compute header totals as exact sum of card footers
// Each card has different logic for what counts as "active" vs "paid"
function computeHeaderFromCards(breakdown: {
  due: KpiBreakdown;
  paid: KpiBreakdown;
  residual: KpiBreakdown;
  overdue: KpiBreakdown;
}) {
  // F24: Dovuto/Residuo/InRitardo = solo Attive, Pagato = Attive + Completate
  const f24DueCents = sumBreakdownByTypes(breakdown.due, F24_ACTIVE);
  const f24PaidCents = sumBreakdownByTypes(breakdown.paid, F24_PAID);
  const f24ResidualCents = sumBreakdownByTypes(breakdown.residual, F24_ACTIVE);
  const f24OverdueCents = sumBreakdownByTypes(breakdown.overdue, F24_ACTIVE);

  // PagoPA: Dovuto/Residuo/InRitardo = solo Attive, Pagato = Attive + Completate
  const pagopaDueCents = sumBreakdownByTypes(breakdown.due, PAGOPA_ACTIVE);
  const pagopaPaidCents = sumBreakdownByTypes(breakdown.paid, PAGOPA_PAID);
  const pagopaResidualCents = sumBreakdownByTypes(breakdown.residual, PAGOPA_ACTIVE);
  const pagopaOverdueCents = sumBreakdownByTypes(breakdown.overdue, PAGOPA_ACTIVE);

  // Rottamazioni: sempre tutte le categorie
  const rottDueCents = sumBreakdownByTypes(breakdown.due, ROTTAMAZIONI_TYPES);
  const rottPaidCents = sumBreakdownByTypes(breakdown.paid, ROTTAMAZIONI_TYPES);
  const rottResidualCents = sumBreakdownByTypes(breakdown.residual, ROTTAMAZIONI_TYPES);
  const rottOverdueCents = sumBreakdownByTypes(breakdown.overdue, ROTTAMAZIONI_TYPES);

  return {
    totalDueCents: f24DueCents + pagopaDueCents + rottDueCents,
    totalPaidCents: f24PaidCents + pagopaPaidCents + rottPaidCents,
    totalResidualCents: f24ResidualCents + pagopaResidualCents + rottResidualCents,
    totalOverdueCents: f24OverdueCents + pagopaOverdueCents + rottOverdueCents,
  };
}

type Stats = { 
  total_due: number; 
  total_paid: number; 
  total_late: number; 
  total_residual: number;
  paid_count: number;
  total_count: number;
  breakdown_by_type: {
    due: KpiBreakdown;
    paid: KpiBreakdown;
    residual: KpiBreakdown;
    overdue: KpiBreakdown;
  };
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
    breakdown_by_type: {
      due: [],
      paid: [],
      residual: [],
      overdue: []
    },
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
        .select("id, total_amount_cents, status, is_f24, residual_amount_cents")
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
      
      // Fetch breakdown by type from DB views
      const [dueByType, paidByType, residualByType, overdueByType] = await Promise.all([
        fetchDueByType(controller.signal),
        fetchPaidByType(controller.signal),
        fetchResidualByType(controller.signal),
        fetchOverdueByType(controller.signal),
      ]);
      
      if (controller.signal.aborted) return;
      
      // Build breakdown object
      const breakdown_by_type = {
        due: dueByType,
        paid: paidByType,
        residual: residualByType,
        overdue: overdueByType,
      };
      
      // CRITICAL: Calculate header totals as exact sum of card footers
      // Header = F24 card total + PagoPA card total + Rottamazioni card total
      const headerTotals = computeHeaderFromCards(breakdown_by_type);
      
      setStats({
        total_due: headerTotals.totalDueCents / 100,      // ✅ Sum of card footers
        total_paid: headerTotals.totalPaidCents / 100,    // ✅ Sum of card footers
        total_late: headerTotals.totalOverdueCents / 100, // ✅ Sum of card footers
        total_residual: headerTotals.totalResidualCents / 100, // ✅ Sum of card footers
        paid_count: 0, // Not used in UI
        total_count: rateationIds.length,
        breakdown_by_type,
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
        breakdown_by_type: {
          due: [],
          paid: [],
          residual: [],
          overdue: []
        },
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