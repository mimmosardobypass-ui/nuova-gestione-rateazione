import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client-resilient';
import { useAuth } from '@/contexts/AuthContext';

export interface F24AtRiskItem {
  rateationId: string;
  numero: string;
  contribuente: string | null;
  unpaidCount: number;
  overdueCount: number;
  nextDueDate: string;
  daysRemaining: number;
  daysOverdue: number;
  riskLevel: 'critical' | 'warning' | 'info';
  nextInstallmentAmountCents: number | null;
}

export interface UseF24AtRiskResult {
  atRiskF24s: F24AtRiskItem[];
  loading: boolean;
  error: string | null;
}

/** Grace period matching the session transfer timeout (8s) */
const GRACE_PERIOD_MS = 8000;

/**
 * Hook to fetch F24 rateations at risk of decadence
 * 
 * LOGIC a 3 LIVELLI:
 * 
 * 🔴 CRITICAL (Rischio decadenza immediato):
 * - Has OVERDUE installments (installments_overdue_today > 0)
 * - AND next due date is within 20 days (f24_days_to_next_due <= 20)
 * 
 * 🟡 WARNING (Attenzione preventiva):
 * - Has UNPAID installments (unpaid > 0) but NO overdue (overdue = 0)
 * - AND next due date is within 30 days (f24_days_to_next_due <= 30)
 * 
 * 🔵 INFO (Promemoria):
 * - Has OVERDUE installments (installments_overdue_today > 0)
 * - BUT next due date is > 30 days (tempo per recuperare)
 */
export function useF24AtRisk(): UseF24AtRiskResult {
  const [atRiskF24s, setAtRiskF24s] = useState<F24AtRiskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gracePeriodDone, setGracePeriodDone] = useState(false);
  
  const { authReady, session } = useAuth();
  const graceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Grace period: wait for session transfer in print windows (8s to match handshake)
  useEffect(() => {
    // Start grace timer if auth is ready but no session yet
    if (authReady && !session && !gracePeriodDone) {
      graceTimerRef.current = setTimeout(() => setGracePeriodDone(true), GRACE_PERIOD_MS);
      return () => {
        if (graceTimerRef.current) {
          clearTimeout(graceTimerRef.current);
          graceTimerRef.current = null;
        }
      };
    }
    
    // If session arrives, mark grace as done immediately (no need to wait)
    if (session && !gracePeriodDone) {
      if (graceTimerRef.current) {
        clearTimeout(graceTimerRef.current);
        graceTimerRef.current = null;
      }
      setGracePeriodDone(true);
    }
  }, [authReady, session, gracePeriodDone]);

  // Main fetch effect - depends on session?.user?.id for deterministic refetch
  useEffect(() => {
    let mounted = true;
    const userId = session?.user?.id;

    async function fetchF24AtRisk() {
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
          setAtRiskF24s([]);
          setLoading(false);
        }
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const today = new Date().toISOString().split('T')[0];

        // Query 1: F24 attive con scadenza entro 30 giorni (critical/warning)
        const { data: urgentData, error: urgentError } = await supabase
          .from('v_rateations_list_ui')
          .select('id, number, taxpayer_name, f24_days_to_next_due, installments_total, installments_paid, installments_overdue_today')
          .eq('is_f24', true)
          .eq('is_pagopa', false)
          .eq('status', 'attiva')
          .not('f24_days_to_next_due', 'is', null)
          .lte('f24_days_to_next_due', 30)
          .order('f24_days_to_next_due', { ascending: true });

        if (urgentError) throw urgentError;

        // Query 2: F24 con rate scadute MA prossima scadenza > 30 giorni (info/promemoria)
        const { data: overdueButSafeData, error: overdueError } = await supabase
          .from('v_rateations_list_ui')
          .select('id, number, taxpayer_name, f24_days_to_next_due, installments_total, installments_paid, installments_overdue_today')
          .eq('is_f24', true)
          .eq('is_pagopa', false)
          .eq('status', 'attiva')
          .gt('installments_overdue_today', 0)
          .gt('f24_days_to_next_due', 30)
          .order('f24_days_to_next_due', { ascending: true });

        if (overdueError) throw overdueError;
        if (!mounted) return;

        // Merge data, avoiding duplicates
        const allData = [...(urgentData || [])];
        const existingIds = new Set(allData.map(r => r.id));
        
        for (const row of (overdueButSafeData || [])) {
          if (!existingIds.has(row.id)) {
            allData.push(row);
          }
        }

        if (allData.length === 0) {
          setAtRiskF24s([]);
          setLoading(false);
          return;
        }

        // Filter: almeno 1 rata non pagata
        const filteredData = allData.filter(row => {
          const unpaid = (row.installments_total ?? 0) - (row.installments_paid ?? 0);
          return unpaid > 0;
        });

        if (filteredData.length === 0) {
          setAtRiskF24s([]);
          setLoading(false);
          return;
        }

        // BATCH FETCH: Get all unpaid installments for all at-risk F24s
        const rateationIds = filteredData.map(r => r.id);
        
        const { data: allInstallments, error: installmentsError } = await supabase
          .from('installments')
          .select('rateation_id, due_date, amount_cents, amount, canceled_at')
          .in('rateation_id', rateationIds)
          .or('is_paid.eq.false,is_paid.is.null')
          .is('canceled_at', null)
          .order('due_date', { ascending: true });

        if (installmentsError) {
          console.error('[useF24AtRisk] Installments query error:', installmentsError);
          throw installmentsError;
        }

        // Build maps: rateation_id -> first unpaid installment data
        const installmentMap = new Map<number, { due_date: string; amount_cents: number | null; amount: number | null }>();
        const overdueMap = new Map<number, { due_date: string }>();
        
        for (const inst of (allInstallments || [])) {
          if (!installmentMap.has(inst.rateation_id)) {
            installmentMap.set(inst.rateation_id, {
              due_date: inst.due_date,
              amount_cents: inst.amount_cents,
              amount: inst.amount
            });
          }
          if (inst.due_date < today && !overdueMap.has(inst.rateation_id)) {
            overdueMap.set(inst.rateation_id, { due_date: inst.due_date });
          }
        }

        // Build F24AtRiskItem with amounts and daysOverdue
        const atRiskWithAmounts: F24AtRiskItem[] = filteredData.map((row) => {
          const daysRemaining = row.f24_days_to_next_due ?? 0;
          const unpaidCount = (row.installments_total ?? 0) - (row.installments_paid ?? 0);
          const overdueCount = row.installments_overdue_today ?? 0;
          
          const riskLevel: 'critical' | 'warning' | 'info' = 
            (overdueCount > 0 && daysRemaining <= 20) ? 'critical' :
            (overdueCount > 0 && daysRemaining > 30) ? 'info' :
            'warning';
          
          const nextDueDate = new Date();
          nextDueDate.setDate(nextDueDate.getDate() + daysRemaining);

          let daysOverdue = 0;
          const overdueData = overdueMap.get(row.id);
          if (overdueData) {
            const overdueDate = new Date(overdueData.due_date);
            const todayDate = new Date(today);
            daysOverdue = Math.floor((todayDate.getTime() - overdueDate.getTime()) / (1000 * 60 * 60 * 24));
          }

          let nextInstallmentAmountCents: number | null = null;
          const instData = installmentMap.get(row.id);
          if (instData) {
            nextInstallmentAmountCents = instData.amount_cents ?? (instData.amount != null ? Math.round(instData.amount * 100) : null);
          }
          
          return {
            rateationId: String(row.id),
            numero: row.number || 'N/A',
            contribuente: row.taxpayer_name,
            unpaidCount,
            overdueCount,
            nextDueDate: nextDueDate.toISOString().split('T')[0],
            daysRemaining,
            daysOverdue,
            riskLevel,
            nextInstallmentAmountCents
          };
        });

        if (mounted) {
          setAtRiskF24s(atRiskWithAmounts);
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

    const handleReload = () => {
      fetchF24AtRisk();
    };

    window.addEventListener('rateations:reload-kpis', handleReload);

    return () => {
      mounted = false;
      window.removeEventListener('rateations:reload-kpis', handleReload);
    };
  }, [authReady, session?.user?.id, gracePeriodDone]);

  return { atRiskF24s, loading, error };
}
