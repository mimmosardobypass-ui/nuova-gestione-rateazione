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
    console.log('🔵 [usePagopaAtRisk] Hook mounted, starting fetch...');
    let mounted = true;

    async function fetchPagopaAtRisk() {
      console.log('🔵 [usePagopaAtRisk] fetchPagopaAtRisk called');
      try {
        setLoading(true);
        setError(null);

        if (!supabase) {
          console.error('[usePagopaAtRisk] Supabase client not available');
          setError('Database non disponibile');
          setLoading(false);
          return;
        }

        const config = ALERT_CONFIG.pagopa;

        // Query v_rateations_list_ui for PagoPA with >= preWarningSkips unpaid overdue
        const { data: atRiskData, error: queryError } = await supabase
          .from('v_rateations_list_ui')
          .select('id, number, taxpayer_name, installments_overdue_today')
          .eq('is_pagopa', true)
          .in('status', ['attiva', 'in_ritardo'])
          .gte('installments_overdue_today', config.preWarningSkips)
          .order('installments_overdue_today', { ascending: false });

        if (queryError) throw queryError;
        if (!mounted) return;

        console.log('[usePagopaAtRisk] Found', atRiskData?.length ?? 0, 'PagoPA with >=', config.preWarningSkips, 'unpaid overdue');

        if (!atRiskData || atRiskData.length === 0) {
          setAtRiskPagopas([]);
          setLoading(false);
          return;
        }

        // For each rateation, find next unpaid installment and calculate days remaining
        const atRiskItems: PagopaAtRiskItem[] = [];

        for (const row of atRiskData) {
          console.log('[usePagopaAtRisk] Processing rateation', row.number, 'with', row.installments_overdue_today, 'overdue');
          
          // Query installments to find next unpaid
          const { data: installments, error: instError } = await supabase
            .from('installments')
            .select('due_date, is_paid')
            .eq('rateation_id', row.id)
            .order('due_date', { ascending: true });

          if (instError) {
            console.error('[usePagopaAtRisk] Error loading installments:', instError);
            continue;
          }

          if (!installments || installments.length === 0) continue;

          // Find next unpaid installment
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          const nextUnpaid = installments.find(inst => !inst.is_paid);
          if (!nextUnpaid || !nextUnpaid.due_date) continue;

          const dueDate = new Date(nextUnpaid.due_date);
          dueDate.setHours(0, 0, 0, 0);
          const daysRemaining = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

          console.log('[usePagopaAtRisk] Next unpaid due:', nextUnpaid.due_date, 'daysRemaining:', daysRemaining);

          // IMPORTANTE: Includere scadenze passate (daysRemaining < 0) e future vicine (0 <= daysRemaining <= threshold)
          // Escludere SOLO se troppo lontane nel futuro (> threshold)
          if (daysRemaining > config.daysThreshold) {
            console.log('[usePagopaAtRisk] Skipping: too far in future');
            continue;
          }

          const skipRemaining = Math.max(0, config.maxSkips - (row.installments_overdue_today ?? 0));

          atRiskItems.push({
            rateationId: String(row.id),
            numero: row.number || 'N/A',
            contribuente: row.taxpayer_name,
            unpaidOverdueCount: row.installments_overdue_today ?? 0,
            skipRemaining,
            nextDueDate: nextUnpaid.due_date,
            daysRemaining,
          });
        }

        // Sort by days remaining (most urgent first - negativi prima)
        atRiskItems.sort((a, b) => a.daysRemaining - b.daysRemaining);

        console.log('[usePagopaAtRisk] Final at-risk items:', atRiskItems.length, atRiskItems.map(i => i.numero).join(', '));

        if (mounted) {
          setAtRiskPagopas(atRiskItems);
        }
      } catch (err: any) {
        console.error('🔴 [usePagopaAtRisk] Error:', err);
        if (mounted) {
          setError(err?.message || 'Errore nel caricamento PagoPA a rischio');
          setAtRiskPagopas([]);
        }
      } finally {
        // SEMPRE impostare loading a false, anche in caso di errore
        if (mounted) {
          console.log('🔵 [usePagopaAtRisk] Setting loading to false');
          setLoading(false);
        }
      }
    }

    fetchPagopaAtRisk();

    // Listen for rateations:reload-kpis event to refresh
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
