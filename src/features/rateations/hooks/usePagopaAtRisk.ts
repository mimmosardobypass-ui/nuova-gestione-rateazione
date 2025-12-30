import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client-resilient';
import { useAuth } from '@/contexts/AuthContext';

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
  const [gracePeriodDone, setGracePeriodDone] = useState(false);
  
  const { authReady, session } = useAuth();

  // Grace period: wait for session transfer in print windows
  useEffect(() => {
    if (authReady && !session && !gracePeriodDone) {
      const timer = setTimeout(() => setGracePeriodDone(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [authReady, session, gracePeriodDone]);

  useEffect(() => {
    let mounted = true;

    async function fetchPagopaAtRisk() {
      // Wait for auth to be ready
      if (!authReady) {
        return;
      }
      
      // Wait for session OR grace period to finish
      if (!session && !gracePeriodDone) {
        return; // Keep loading while waiting
      }
      
      // After grace period, if still no session, show error
      if (!session && gracePeriodDone) {
        if (mounted) {
          setError('Sessione non disponibile per la stampa');
          setAtRiskPagopas([]);
          setLoading(false);
        }
        return;
      }

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

        // BATCH FETCH: Get all unpaid installments for all at-risk PagoPAs
        // Use robust query: is_paid = false OR is_paid IS NULL (since is_paid can be nullable)
        const rateationIds = atRiskBase.map(item => Number(item.rateationId));
        
        const { data: allInstallments, error: installmentsError } = await supabase
          .from('installments')
          .select('rateation_id, due_date, amount_cents, amount, canceled_at')
          .in('rateation_id', rateationIds)
          .or('is_paid.eq.false,is_paid.is.null')
          .is('canceled_at', null)
          .order('due_date', { ascending: true });

        if (installmentsError) {
          console.error('[usePagopaAtRisk] Installments query error:', installmentsError);
          throw installmentsError;
        }

        // Build map: rateation_id -> first unpaid installment
        const installmentMap = new Map<number, { due_date: string; amount_cents: number | null; amount: number | null }>();
        for (const inst of (allInstallments || [])) {
          if (!installmentMap.has(inst.rateation_id)) {
            installmentMap.set(inst.rateation_id, {
              due_date: inst.due_date,
              amount_cents: inst.amount_cents,
              amount: inst.amount
            });
          }
        }

        // Enrich atRiskBase with installment data
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const atRiskWithDueDates = atRiskBase.map(item => {
          const instData = installmentMap.get(Number(item.rateationId));
          if (instData) {
            const nextDueDate = new Date(instData.due_date);
            const daysRemaining = Math.ceil((nextDueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            const amountCents = instData.amount_cents ?? (instData.amount != null ? Math.round(instData.amount * 100) : null);
            
            return {
              ...item,
              nextDueDate: instData.due_date,
              daysRemaining: Math.max(0, daysRemaining),
              nextInstallmentAmountCents: amountCents
            };
          }
          return item;
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
  }, [authReady, session, gracePeriodDone]);

  return { atRiskPagopas, loading, error };
}
