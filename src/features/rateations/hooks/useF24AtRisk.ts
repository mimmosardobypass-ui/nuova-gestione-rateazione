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

        // Fetch all F24 rateations that are not completed or decaduta
        const { data: f24Rateations, error: rateationsError } = await supabase
          .from('rateations')
          .select('id, number, taxpayer_name, status')
          .eq('is_f24', true)
          .neq('status', 'completata')
          .neq('status', 'decaduta')
          .neq('status', 'COMPLETATA')
          .neq('status', 'DECADUTA');

        if (rateationsError) throw rateationsError;
        if (!mounted) return;

        if (!f24Rateations || f24Rateations.length === 0) {
          setAtRiskF24s([]);
          setLoading(false);
          return;
        }

        // Fetch installments for all F24s
        const f24Ids = f24Rateations.map(r => r.id);
        const { data: installments, error: installmentsError } = await supabase
          .from('installments')
          .select('id, rateation_id, due_date, is_paid, paid_at, paid_date')
          .in('rateation_id', f24Ids);

        if (installmentsError) throw installmentsError;
        if (!mounted) return;

        // Calculate recovery window for each F24
        const atRisk: F24AtRiskItem[] = [];
        
        for (const rateation of f24Rateations) {
          const rateationInstallments = (installments || []).filter(
            inst => inst.rateation_id === rateation.id
          );

          const recoveryInfo = calculateF24RecoveryWindow(rateationInstallments);

          // Only include if at risk (daysRemaining <= 20)
          if (recoveryInfo.isAtRisk && recoveryInfo.nextDueDate) {
            atRisk.push({
              rateationId: String(rateation.id),
              numero: rateation.number || 'N/A',
              contribuente: rateation.taxpayer_name,
              unpaidCount: recoveryInfo.unpaidCount,
              nextDueDate: recoveryInfo.nextDueDate,
              daysRemaining: recoveryInfo.daysRemaining
            });
          }
        }

        // Sort by days remaining (most urgent first)
        atRisk.sort((a, b) => a.daysRemaining - b.daysRemaining);

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
