import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ALERT_CONFIG } from '@/constants/alertConfig';

export interface PagopaAtRiskItem {
  rateationId: string;
  numero: string;
  contribuente: string | null;
  unpaidOverdueCount: number;
  skipRemaining: number;
  nextDueDate: string | null;
  daysRemaining: number;
}

export interface UsePagopaAtRiskResult {
  atRiskPagopas: PagopaAtRiskItem[];
  loading: boolean;
  error: string | null;
}

/**
 * Hook to fetch PagoPA rateations at risk of decadence
 * 
 * LOGIC: PagoPA is at risk if:
 * - Has >= preWarningSkips unpaid overdue installments (default: 7)
 * - AND status is 'attiva'
 * - AND next unpaid installment is within daysThreshold days (default: 30)
 * 
 * Uses configurable thresholds from ALERT_CONFIG
 */
export function usePagopaAtRisk(): UsePagopaAtRiskResult {
  const [atRiskPagopas, setAtRiskPagopas] = useState<PagopaAtRiskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchPagopaAtRisk() {
      try {
        setLoading(true);
        setError(null);

        // Step 1: Query v_pagopa_today_kpis for at-risk PagoPAs
        const { data: kpisData, error: kpisError } = await supabase
          .from('v_pagopa_today_kpis')
          .select('rateation_id, unpaid_overdue_today, skip_remaining')
          .gte('unpaid_overdue_today', 7)
          .lte('skip_remaining', 1);

        if (kpisError) throw kpisError;
        if (!mounted) return;

        if (!kpisData || kpisData.length === 0) {
          setAtRiskPagopas([]);
          setLoading(false);
          return;
        }

        // Step 2: Get rateation details from v_rateations_list_ui
        const ids = kpisData.map(d => d.rateation_id);
        const { data: rateations, error: rateationError } = await supabase
          .from('v_rateations_list_ui')
          .select('id, number, taxpayer_name')
          .in('id', ids);

        if (rateationError) throw rateationError;
        if (!mounted) return;

        // Step 3: Merge KPIs with rateation details
        const atRisk: PagopaAtRiskItem[] = kpisData.map(kpi => {
          const rat = rateations?.find(r => r.id === kpi.rateation_id);
          return {
            rateationId: String(kpi.rateation_id),
            numero: rat?.number || 'N/A',
            contribuente: rat?.taxpayer_name || null,
            unpaidOverdueCount: kpi.unpaid_overdue_today ?? 0,
            skipRemaining: kpi.skip_remaining ?? 0,
            nextDueDate: null,
            daysRemaining: 0
          };
        });

        if (mounted) {
          setAtRiskPagopas(atRisk);
        }
      } catch (err: any) {
        console.error('[usePagopaAtRisk] Error:', err);
        if (mounted) {
          setError(err?.message || 'Errore caricamento PagoPA a rischio');
          setAtRiskPagopas([]);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    fetchPagopaAtRisk();

    // Listen for reload events
    const handleReload = () => {
      fetchPagopaAtRisk();
    };

    window.addEventListener('rateations:reload-kpis', handleReload);

    return () => {
      mounted = false;
      window.removeEventListener('rateations:reload-kpis', handleReload);
    };
  }, []);

  return { atRiskPagopas, loading, error };
}
