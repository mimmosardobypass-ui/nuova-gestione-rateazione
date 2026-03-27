import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client-resilient';
import { useAuth } from '@/contexts/AuthContext';

export interface PagopaUpcomingItem {
  rateationId: string;
  numero: string;
  contribuente: string | null;
  nextDueDate: string;
  daysRemaining: number;
  amountCents: number | null;
  isFirstInstallment: boolean;
  unpaidOverdueCount: number;
  skipRemaining: number;
}

export interface UsePagopaUpcomingResult {
  upcomingPagopas: PagopaUpcomingItem[];
  loading: boolean;
  error: string | null;
}

const GRACE_PERIOD_MS = 8000;

/**
 * Hook per PagoPA con scadenze imminenti (30gg) che NON sono già nella sezione critica.
 * Include la regola "prima rata tassativa": seq=1 non pagata = rischio ALTO.
 */
export function usePagopaUpcoming(): UsePagopaUpcomingResult {
  const [upcomingPagopas, setUpcomingPagopas] = useState<PagopaUpcomingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gracePeriodDone, setGracePeriodDone] = useState(false);

  const { authReady, session } = useAuth();
  const graceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (authReady && !session && !gracePeriodDone) {
      graceTimerRef.current = setTimeout(() => setGracePeriodDone(true), GRACE_PERIOD_MS);
      return () => { if (graceTimerRef.current) clearTimeout(graceTimerRef.current); };
    }
    if (session && !gracePeriodDone) {
      if (graceTimerRef.current) clearTimeout(graceTimerRef.current);
      setGracePeriodDone(true);
    }
  }, [authReady, session, gracePeriodDone]);

  useEffect(() => {
    let mounted = true;

    async function fetchUpcoming() {
      if (!authReady) return;
      if (!session && !gracePeriodDone) return;
      if (!session && gracePeriodDone) {
        if (mounted) { setError('Sessione non disponibile'); setUpcomingPagopas([]); setLoading(false); }
        return;
      }
      if (!supabase) {
        if (mounted) { setUpcomingPagopas([]); setLoading(false); }
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // 1. Get ALL PagoPA KPIs
        const { data: allKpis, error: kpisErr } = await supabase
          .from('v_pagopa_today_kpis')
          .select('rateation_id, unpaid_overdue_today, skip_remaining');
        if (kpisErr) throw kpisErr;
        if (!mounted) return;

        // 2. Filter out already-critical ones (>=7 overdue AND <=1 skip)
        const nonCriticalKpis = (allKpis || []).filter(
          k => !(k.unpaid_overdue_today >= 7 && k.skip_remaining <= 1)
        );
        if (nonCriticalKpis.length === 0) {
          if (mounted) { setUpcomingPagopas([]); setLoading(false); }
          return;
        }

        const ids = nonCriticalKpis.map(k => k.rateation_id);

        // 3. Get rateation details (only active)
        const { data: rateations, error: ratErr } = await supabase
          .from('v_rateations_list_ui')
          .select('id, number, taxpayer_name, status')
          .in('id', ids)
          .in('status', ['attiva', 'in_ritardo', 'ATTIVA', 'IN_RITARDO']);
        if (ratErr) throw ratErr;
        if (!mounted) return;

        const activeIds = (rateations || []).map(r => r.id);
        if (activeIds.length === 0) {
          if (mounted) { setUpcomingPagopas([]); setLoading(false); }
          return;
        }

        // 4. Get unpaid installments due within next 30 days
        const todayMid = new Date();
        todayMid.setHours(0, 0, 0, 0);
        const todayISO = todayMid.toISOString().split('T')[0];
        const in30 = new Date(todayMid);
        in30.setDate(in30.getDate() + 30);
        const in30ISO = in30.toISOString().split('T')[0];

        const { data: installments, error: instErr } = await supabase
          .from('installments')
          .select('rateation_id, due_date, amount_cents, amount, seq')
          .in('rateation_id', activeIds)
          .or('is_paid.eq.false,is_paid.is.null')
          .is('canceled_at', null)
          .gte('due_date', todayISO)
          .lte('due_date', in30ISO)
          .order('due_date', { ascending: true });
        if (instErr) throw instErr;
        if (!mounted) return;

        // 5. Build map: rateation_id -> first upcoming installment
        const instMap = new Map<number, { due_date: string; amount_cents: number | null; amount: number | null; seq: number }>();
        for (const inst of (installments || [])) {
          if (!instMap.has(inst.rateation_id)) {
            instMap.set(inst.rateation_id, {
              due_date: inst.due_date,
              amount_cents: inst.amount_cents,
              amount: inst.amount,
              seq: inst.seq,
            });
          }
        }

        // 6. Build results
        const results: PagopaUpcomingItem[] = [];
        for (const [ratId, instData] of instMap) {
          const rat = rateations?.find(r => r.id === ratId);
          const kpi = nonCriticalKpis.find(k => k.rateation_id === ratId);
          if (!rat || !kpi) continue;

          const nextDue = new Date(instData.due_date);
          nextDue.setHours(0, 0, 0, 0);
          const daysRemaining = Math.max(0, Math.ceil((nextDue.getTime() - todayMid.getTime()) / (1000 * 60 * 60 * 24)));
          const amountCents = instData.amount_cents ?? (instData.amount != null ? Math.round(instData.amount * 100) : null);

          results.push({
            rateationId: String(ratId),
            numero: rat.number || 'N/A',
            contribuente: rat.taxpayer_name || null,
            nextDueDate: instData.due_date,
            daysRemaining,
            amountCents,
            isFirstInstallment: instData.seq === 1,
            unpaidOverdueCount: kpi.unpaid_overdue_today ?? 0,
            skipRemaining: kpi.skip_remaining ?? 0,
          });
        }

        // Sort: first installments first, then by days remaining
        results.sort((a, b) => {
          if (a.isFirstInstallment && !b.isFirstInstallment) return -1;
          if (!a.isFirstInstallment && b.isFirstInstallment) return 1;
          return a.daysRemaining - b.daysRemaining;
        });

        if (mounted) setUpcomingPagopas(results);
      } catch (err: any) {
        console.error('[usePagopaUpcoming] Error:', err);
        if (mounted) { setError(err?.message || 'Errore caricamento'); setUpcomingPagopas([]); }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchUpcoming();

    const handleReload = () => fetchUpcoming();
    window.addEventListener('rateations:reload-kpis', handleReload);
    return () => {
      mounted = false;
      window.removeEventListener('rateations:reload-kpis', handleReload);
    };
  }, [authReady, session?.user?.id, gracePeriodDone]);

  return { upcomingPagopas, loading, error };
}
