import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client-resilient';
import { calculateF24RecoveryWindow } from '../utils/f24RecoveryWindow';

export interface F24AtRiskItem {
  rateationId: string;
  numero: string;
  contribuente: string | null;
  unpaidCount: number;
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
 * (with unpaid installments due within 20 days)
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

        // SIMPLIFIED: Query v_rateations_list_ui directly with f24_days_to_next_due filter
        // The view now calculates the recovery window server-side
        const { data: atRiskData, error: queryError } = await supabase
          .from('v_rateations_list_ui')
          .select('id, number, taxpayer_name, f24_days_to_next_due, installments_total, installments_paid')
          .eq('is_f24', true)
          .not('f24_days_to_next_due', 'is', null)
          .lte('f24_days_to_next_due', 20)
          .order('f24_days_to_next_due', { ascending: true });

        if (queryError) throw queryError;
        if (!mounted) return;

        // Map to F24AtRiskItem format
        const atRisk: F24AtRiskItem[] = (atRiskData || []).map(row => {
          const unpaidCount = row.installments_total - row.installments_paid;
          const daysRemaining = row.f24_days_to_next_due!;
          
          // Calculate nextDueDate from days remaining
          const nextDueDate = new Date();
          nextDueDate.setDate(nextDueDate.getDate() + daysRemaining);
          
          return {
            rateationId: String(row.id),
            numero: row.number || 'N/A',
            contribuente: row.taxpayer_name,
            unpaidCount,
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
