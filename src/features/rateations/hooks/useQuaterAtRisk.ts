import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client-resilient';

/** Costanti per la logica Quater */
export const QUATER_TOLERANCE_DAYS = 5;
export const QUATER_VISIBILITY_WINDOW = 20;

export interface QuaterAtRiskItem {
  rateationId: string;
  numero: string;
  contribuente: string | null;
  tipoQuater: string; // 'Rottamazione Quater' | 'Riam.Quater'
  importoRata: number;
  dueDateRata: string;        // Scadenza rata originale
  decadenceDate: string;      // Scadenza + 5 giorni
  daysToDecadence: number;    // Countdown verso decadenza
  riskLevel: 'critical' | 'warning' | 'caution' | 'ok';
}

export interface UseQuaterAtRiskResult {
  atRiskQuaters: QuaterAtRiskItem[];
  loading: boolean;
  error: string | null;
}

/**
 * Hook to fetch Quater/Riam.Quater rateations at risk of decadence
 * 
 * LOGIC:
 * - Calcola la data di decadenza come: dueDateRata + 5 giorni (tolleranza)
 * - Mostra solo le rateazioni con daysToDecadence <= 20 (finestra di visibilità)
 * 
 * RISK LEVELS:
 * 🔴 CRITICAL: daysToDecadence <= 0 (tolleranza esaurita, decadenza!)
 * 🟠 WARNING:  daysToDecadence 1-5 (dentro tolleranza ma urgente)
 * 🟡 CAUTION:  daysToDecadence 6-10 (attenzione)
 * 🟢 OK:       daysToDecadence 11-20 (monitoraggio)
 */
export function useQuaterAtRisk(): UseQuaterAtRiskResult {
  const [atRiskQuaters, setAtRiskQuaters] = useState<QuaterAtRiskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchQuaterAtRisk() {
      // Check supabase client availability
      if (!supabase) {
        console.warn('[useQuaterAtRisk] Supabase client not available');
        if (mounted) {
          setAtRiskQuaters([]);
          setLoading(false);
          setError(null); // Non mostrare errore, solo skip silenzioso
        }
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Query rateazioni Quater attive con rate non pagate
        const { data, error: queryError } = await supabase
          .from('v_rateations_list_ui')
          .select(`
            id, 
            number, 
            taxpayer_name, 
            tipo,
            is_quater
          `)
          .eq('is_quater', true)
          .in('status', ['attiva', 'ATTIVA', 'in_ritardo']);

        if (queryError) {
          console.error('[useQuaterAtRisk] Query error:', queryError);
          throw queryError;
        }
        if (!mounted) return;

        if (!data || data.length === 0) {
          console.log('[useQuaterAtRisk] No Quater rateations found');
          setAtRiskQuaters([]);
          setLoading(false);
          return;
        }

        // Per ogni rateazione Quater, recupera la prossima rata non pagata
        const quaterIds = data.map(r => r.id);
        
        let installmentsData: any[] = [];
        try {
          const { data: instData, error: instError } = await supabase
            .from('installments')
            .select('rateation_id, due_date, amount, is_paid')
            .in('rateation_id', quaterIds)
            .eq('is_paid', false)
            .order('due_date', { ascending: true });

          if (instError) {
            console.warn('[useQuaterAtRisk] Installments query warning:', instError);
            // Non bloccare, continua senza dati installments
          } else {
            installmentsData = instData || [];
          }
        } catch (instQueryErr) {
          console.error('[useQuaterAtRisk] Installments query error:', instQueryErr);
          // Non bloccare, continua con array vuoto
        }

        // Raggruppa per rateation_id e prendi la più vicina
        const installmentsByRateation = new Map<number, typeof installmentsData[0]>();
        for (const inst of installmentsData || []) {
          if (!installmentsByRateation.has(inst.rateation_id)) {
            installmentsByRateation.set(inst.rateation_id, inst);
          }
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Costruisci la lista di rateazioni a rischio
        const atRisk: QuaterAtRiskItem[] = [];
        
        for (const row of data) {
          try {
            const nextInstallment = installmentsByRateation.get(row.id);
            if (!nextInstallment) continue; // Nessuna rata non pagata
            
            // Validazione date
            if (!nextInstallment.due_date) {
              console.warn('[useQuaterAtRisk] Missing due_date for rateation:', row.id);
              continue;
            }
            
            const dueDate = new Date(nextInstallment.due_date);
            if (isNaN(dueDate.getTime())) {
              console.warn('[useQuaterAtRisk] Invalid due_date for rateation:', row.id, nextInstallment.due_date);
              continue;
            }
            dueDate.setHours(0, 0, 0, 0);
          
          // Data decadenza = scadenza rata + 5 giorni di tolleranza
          const decadenceDate = new Date(dueDate);
          decadenceDate.setDate(decadenceDate.getDate() + QUATER_TOLERANCE_DAYS);
          
          // Giorni alla decadenza
          const daysToDecadence = Math.ceil(
            (decadenceDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
          );
          
          // Filtra solo quelle entro la finestra di visibilità (20 giorni)
          if (daysToDecadence > QUATER_VISIBILITY_WINDOW) continue;
          
          // Classifica per livello di rischio
          let riskLevel: 'critical' | 'warning' | 'caution' | 'ok';
          if (daysToDecadence <= 0) {
            riskLevel = 'critical'; // 🔴 Decadenza!
          } else if (daysToDecadence <= 5) {
            riskLevel = 'warning';  // 🟠 Urgente (dentro tolleranza)
          } else if (daysToDecadence <= 10) {
            riskLevel = 'caution';  // 🟡 Attenzione
          } else {
            riskLevel = 'ok';       // 🟢 Monitoraggio
          }
          
            atRisk.push({
              rateationId: String(row.id),
              numero: row.number || 'N/A',
              contribuente: row.taxpayer_name,
              tipoQuater: row.tipo || (row.is_quater ? 'Quater' : 'N/D'),
              importoRata: Number(nextInstallment.amount) || 0,
              dueDateRata: nextInstallment.due_date,
              decadenceDate: decadenceDate.toISOString().split('T')[0],
              daysToDecadence,
              riskLevel
            });
          } catch (rowErr) {
            console.warn('[useQuaterAtRisk] Error processing row:', row.id, rowErr);
            // Skip this row and continue
          }
        }

        // Ordina per giorni alla decadenza (più urgenti prima)
        atRisk.sort((a, b) => a.daysToDecadence - b.daysToDecadence);

        if (mounted) {
          setAtRiskQuaters(atRisk);
        }
      } catch (err: any) {
        console.error('[useQuaterAtRisk] Error:', err);
        if (mounted) {
          setError(err?.message || 'Errore nel caricamento Quater a rischio');
          setAtRiskQuaters([]);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    fetchQuaterAtRisk();

    // Listen for rateations:reload-kpis event to refresh
    const handleReload = () => {
      fetchQuaterAtRisk();
    };

    window.addEventListener('rateations:reload-kpis', handleReload);

    return () => {
      mounted = false;
      window.removeEventListener('rateations:reload-kpis', handleReload);
    };
  }, []);

  return { atRiskQuaters, loading, error };
}
