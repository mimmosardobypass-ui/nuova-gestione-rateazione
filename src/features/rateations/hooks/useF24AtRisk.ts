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
  riskLevel: 'critical' | 'warning'; // ✅ NUOVO: Livello di urgenza
}

export interface UseF24AtRiskResult {
  atRiskF24s: F24AtRiskItem[];
  loading: boolean;
  error: string | null;
}

/**
 * Hook to fetch F24 rateations at risk of decadence
 * 
 * LOGIC a 2 LIVELLI:
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

        // Query v_rateations_list_ui - Fetch F24 attive con scadenza entro 30 giorni
        // La classificazione critical/warning avviene lato client
        //防御层: Exclude PagoPA even if is_f24 flag is incorrectly set
        const { data: atRiskData, error: queryError } = await supabase
          .from('v_rateations_list_ui')
          .select('id, number, taxpayer_name, f24_days_to_next_due, installments_total, installments_paid, installments_overdue_today')
          .eq('is_f24', true)
          .eq('is_pagopa', false) //防御: Prevent PagoPA from appearing in F24 alerts
          .eq('status', 'attiva')
          .not('f24_days_to_next_due', 'is', null)
          .lte('f24_days_to_next_due', 30) // ✅ Esteso a 30 giorni per monitoraggio preventivo
          .order('f24_days_to_next_due', { ascending: true });

        if (queryError) throw queryError;
        if (!mounted) return;

        if (!atRiskData || atRiskData.length === 0) {
          setAtRiskF24s([]);
          setLoading(false);
          return;
        }

        // ✅ Filter client-side: almeno 1 rata non pagata
        const filteredData = atRiskData.filter(row => {
          const unpaid = (row.installments_total ?? 0) - (row.installments_paid ?? 0);
          return unpaid > 0;
        });

        if (filteredData.length === 0) {
          setAtRiskF24s([]);
          setLoading(false);
          return;
        }

        // Transform view data to F24AtRiskItem format con classificazione a 2 livelli
        const atRisk: F24AtRiskItem[] = filteredData.map(row => {
          const daysRemaining = row.f24_days_to_next_due ?? 0;
          const unpaidCount = (row.installments_total ?? 0) - (row.installments_paid ?? 0);
          const overdueCount = row.installments_overdue_today ?? 0;
          
          // ✅ Classificazione a 2 livelli
          // 🔴 CRITICAL: overdue > 0 AND days <= 20 (rischio decadenza immediato)
          // 🟡 WARNING: unpaid > 0 but overdue = 0 AND days <= 30 (attenzione preventiva)
          const riskLevel: 'critical' | 'warning' = 
            (overdueCount > 0 && daysRemaining <= 20) ? 'critical' : 'warning';
          
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
            daysRemaining,
            riskLevel // ✅ NUOVO
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
