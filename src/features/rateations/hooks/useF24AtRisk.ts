import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client-resilient';

export interface F24AtRiskItem {
  rateationId: string;
  numero: string;
  contribuente: string | null;
  unpaidCount: number;
  overdueCount: number; // Number of overdue installments
  nextDueDate: string;
  daysRemaining: number;
}

export interface UseF24AtRiskResult {
  atRiskF24s: F24AtRiskItem[];
  loading: boolean;
  error: string | null;
}

/**
 * Hook to fetch F24 rateations at risk of decadence
 * 
 * LOGIC: F24 is at risk if:
 * - Has OVERDUE installments (installments_overdue_today > 0)
 * - AND next due date is within 20 days (f24_days_to_next_due <= 20)
 * - AND status is 'attiva'
 * 
 * If there are no overdue installments, the F24 is NOT at risk,
 * even if the next due date is approaching.
 * 
 * OPTIMIZED: Uses server-side calculated fields from v_rateations_list_ui view
 */
export function useF24AtRisk(): UseF24AtRiskResult {
  const [atRiskF24s, setAtRiskF24s] = useState<F24AtRiskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchF24AtRisk() {
      try {
        setLoading(true);
        setError(null);

        // Query v_rateations_list_ui with server-side filtering
        // Only F24s with OVERDUE installments AND f24_days_to_next_due <= 20 AND status = 'attiva'
        //防御层: Exclude PagoPA even if is_f24 flag is incorrectly set
        const { data: atRiskData, error: queryError } = await supabase
          .from('v_rateations_list_ui')
          .select('id, number, taxpayer_name, f24_days_to_next_due, installments_total, installments_paid, installments_overdue_today')
          .eq('is_f24', true)
          .eq('is_pagopa', false) //防御: Prevent PagoPA from appearing in F24 alerts
          .eq('status', 'attiva')
          .not('f24_days_to_next_due', 'is', null)
          .lte('f24_days_to_next_due', 20)
          .gt('installments_overdue_today', 0) // CRITICAL: Only F24s with overdue installments are at risk
          .order('f24_days_to_next_due', { ascending: true });

        if (queryError) throw queryError;
        if (!mounted) return;

        if (!atRiskData || atRiskData.length === 0) {
          setAtRiskF24s([]);
          setLoading(false);
          return;
        }

        // Transform view data to F24AtRiskItem format
        const atRisk: F24AtRiskItem[] = atRiskData.map(row => {
          const daysRemaining = row.f24_days_to_next_due ?? 0;
          const unpaidCount = (row.installments_total ?? 0) - (row.installments_paid ?? 0);
          const overdueCount = row.installments_overdue_today ?? 0;
          
          // Calculate next due date from days remaining
          const nextDueDate = new Date();
          nextDueDate.setDate(nextDueDate.getDate() + daysRemaining);
          
          return {
            rateationId: String(row.id),
            numero: row.number || 'N/A',
            contribuente: row.taxpayer_name,
            unpaidCount,
            overdueCount,
            nextDueDate: nextDueDate.toISOString().split('T')[0],
            daysRemaining
          };
        });

        if (mounted) {
          setAtRiskF24s(atRisk);
        }
      } catch (err: any) {
        console.error('[useF24AtRisk] Error:', err);
        if (mounted) {
          setError(err?.message || 'Errore nel caricamento F24 a rischio');
          setAtRiskF24s([]);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    fetchF24AtRisk();

    // Listen for rateations:reload-kpis event to refresh
    const handleReload = () => {
      fetchF24AtRisk();
    };

    window.addEventListener('rateations:reload-kpis', handleReload);

    return () => {
      mounted = false;
      window.removeEventListener('rateations:reload-kpis', handleReload);
    };
  }, []);

  return { atRiskF24s, loading, error };
}
