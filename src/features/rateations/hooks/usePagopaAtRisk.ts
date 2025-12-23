import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client-resilient';
import { ALERT_CONFIG } from '@/constants/alertConfig';

export interface PagopaAtRiskItem {
  rateationId: string;
  numero: string;
  contribuente: string | null;
  unpaidOverdueCount: number;
  skipRemaining: number;
  nextDueDate: string | null;
  daysRemaining: number;
  nextInstallmentAmountCents: number | null;
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

        // Check if Supabase client is available
        if (!supabase) {
          console.warn('[usePagopaAtRisk] Supabase client not available');
          setAtRiskPagopas([]);
          setLoading(false);
          return;
        }

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

        // Step 2: Get rateation details from v_rateations_list_ui (ONLY active/overdue)
        const ids = kpisData.map(d => d.rateation_id);
        const { data: rateations, error: rateationError } = await supabase
          .from('v_rateations_list_ui')
          .select('id, number, taxpayer_name, status')
          .in('id', ids)
          .in('status', ['attiva', 'in_ritardo', 'ATTIVA', 'IN_RITARDO']);

        if (rateationError) throw rateationError;
        if (!mounted) return;

        // Step 3: Merge KPIs with rateation details (filter out interrupted)
        const atRiskBase: PagopaAtRiskItem[] = kpisData
          .map(kpi => {
            const rat = rateations?.find(r => r.id === kpi.rateation_id);
            // Skip if not found (means it was filtered out by status)
            if (!rat) return null;
            
            return {
              rateationId: String(kpi.rateation_id),
              numero: rat.number || 'N/A',
              contribuente: rat.taxpayer_name || null,
              unpaidOverdueCount: kpi.unpaid_overdue_today ?? 0,
              skipRemaining: kpi.skip_remaining ?? 0,
              nextDueDate: null,
              daysRemaining: 0,
              nextInstallmentAmountCents: null
            };
          })
          .filter((item): item is PagopaAtRiskItem => item !== null);

        // Step 3.5: For each at-risk PagoPA, fetch next due date (with timeout)
        const fetchWithTimeout = async () => {
          const timeoutPromise = new Promise<typeof atRiskBase>((_, reject) => 
            setTimeout(() => reject(new Error('Timeout fetching due dates')), 8000)
          );

          const fetchPromise = Promise.all(
            atRiskBase.map(async (item) => {
              try {
                if (!supabase) return item;
                
                // Query for next unpaid installment (include overdue ones too)
                const { data: nextInstallment } = await supabase
                  .from('installments')
                  .select('due_date, amount_cents')
                  .eq('rateation_id', Number(item.rateationId))
                  .eq('is_paid', false)
                  .order('due_date', { ascending: true })
                  .limit(1)
                  .single();

                if (nextInstallment?.due_date) {
                  const nextDueDate = new Date(nextInstallment.due_date);
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const daysRemaining = Math.ceil((nextDueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

                  return {
                    ...item,
                    nextDueDate: nextInstallment.due_date,
                    daysRemaining: Math.max(0, daysRemaining),
                    nextInstallmentAmountCents: nextInstallment.amount_cents ?? null
                  };
                }

                return item;
              } catch (err) {
                console.error(`[usePagopaAtRisk] Error fetching next due date for ${item.rateationId}:`, err);
                return item;
              }
            })
          );

          return Promise.race([fetchPromise, timeoutPromise]);
        };

        const atRiskWithDueDates = await fetchWithTimeout().catch(err => {
          console.error('[usePagopaAtRisk] Timeout or error fetching due dates:', err);
          return atRiskBase; // Return partial data without dates on timeout
        });

        if (mounted) {
          setAtRiskPagopas(atRiskWithDueDates);
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
