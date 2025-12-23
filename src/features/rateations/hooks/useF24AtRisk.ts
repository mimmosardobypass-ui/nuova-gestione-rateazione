import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client-resilient';

console.log('📦 [useF24AtRisk] Module loaded');

export interface F24AtRiskItem {
  rateationId: string;
  numero: string;
  contribuente: string | null;
  unpaidCount: number;
  overdueCount: number;
  nextDueDate: string;
  daysRemaining: number;
  daysOverdue: number; // Giorni da cui la prima rata è scaduta
  riskLevel: 'critical' | 'warning' | 'info';
  nextInstallmentAmountCents: number | null;
}

export interface UseF24AtRiskResult {
  atRiskF24s: F24AtRiskItem[];
  loading: boolean;
  error: string | null;
}

/**
 * Hook to fetch F24 rateations at risk of decadence
 * 
 * LOGIC a 3 LIVELLI:
 * 
 * 🔴 CRITICAL (Rischio decadenza immediato):
 * - Has OVERDUE installments (installments_overdue_today > 0)
 * - AND next due date is within 20 days (f24_days_to_next_due <= 20)
 * - Richiede azione URGENTE
 * 
 * 🟡 WARNING (Attenzione preventiva):
 * - Has UNPAID installments (unpaid > 0) but NO overdue (overdue = 0)
 * - AND next due date is within 30 days (f24_days_to_next_due <= 30)
 * - Richiede pianificazione pagamento
 * 
 * 🔵 INFO (Promemoria):
 * - Has OVERDUE installments (installments_overdue_today > 0)
 * - BUT next due date is > 30 days (tempo per recuperare)
 * - Non a rischio decadenza, pagamento consigliato
 */
export function useF24AtRisk(): UseF24AtRiskResult {
  console.log('🔄 [useF24AtRisk] Hook initialized');
  
  const [atRiskF24s, setAtRiskF24s] = useState<F24AtRiskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    console.log('🔄 [useF24AtRisk] useEffect running, fetching data...');

    async function fetchF24AtRisk() {
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

        // Build F24AtRiskItem with amounts and daysOverdue
        const atRiskWithAmounts: F24AtRiskItem[] = await Promise.all(
          filteredData.map(async (row) => {
            const daysRemaining = row.f24_days_to_next_due ?? 0;
            const unpaidCount = (row.installments_total ?? 0) - (row.installments_paid ?? 0);
            const overdueCount = row.installments_overdue_today ?? 0;
            
            // 3 livelli di rischio
            const riskLevel: 'critical' | 'warning' | 'info' = 
              (overdueCount > 0 && daysRemaining <= 20) ? 'critical' :
              (overdueCount > 0 && daysRemaining > 30) ? 'info' :
              'warning';
            
            const nextDueDate = new Date();
            nextDueDate.setDate(nextDueDate.getDate() + daysRemaining);

            // Query per prima rata scaduta (per calcolare daysOverdue)
            let daysOverdue = 0;
            let nextInstallmentAmountCents: number | null = null;
            
            // Query 1: Prima rata scaduta (per daysOverdue) - TRY/CATCH SEPARATO
            if (overdueCount > 0) {
              try {
                const { data: firstOverdue } = await supabase
                  .from('installments')
                  .select('due_date')
                  .eq('rateation_id', row.id)
                  .eq('is_paid', false)
                  .lt('due_date', today)
                  .order('due_date', { ascending: true })
                  .limit(1)
                  .single();
                
                if (firstOverdue?.due_date) {
                  const overdueDate = new Date(firstOverdue.due_date);
                  const todayDate = new Date(today);
                  daysOverdue = Math.floor((todayDate.getTime() - overdueDate.getTime()) / (1000 * 60 * 60 * 24));
                }
              } catch {
                // Ignore error, keep daysOverdue = 0
              }
            }

            // Query 2: Prima rata non pagata (per importo) - TRY/CATCH SEPARATO
            try {
              const { data: installment } = await supabase
                .from('installments')
                .select('amount_cents')
                .eq('rateation_id', row.id)
                .eq('is_paid', false)
                .order('due_date', { ascending: true })
                .limit(1)
                .single();
              
              nextInstallmentAmountCents = installment?.amount_cents ?? null;
            } catch {
              // Ignore error, keep nextInstallmentAmountCents = null
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
          })
        );

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
  }, []);

  return { atRiskF24s, loading, error };
}
