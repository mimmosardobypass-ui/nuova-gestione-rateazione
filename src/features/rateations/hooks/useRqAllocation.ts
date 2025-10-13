import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface PagopaForAllocation {
  id: number;
  number: string;
  taxpayer_name?: string;
  allocatable_cents: number;
  residual_cents: number;
}

export interface RqForAllocation {
  id: number;
  number: string;
  taxpayer_name?: string;
  total_cents: number;
}

export interface RqAllocationData {
  availablePagopa: PagopaForAllocation[];
  availableRq: RqForAllocation[];
  loading: boolean;
  error?: string;
}

/**
 * Hook per gestire dati necessari per l'allocazione RQ
 * Carica PagoPA con quota disponibile e RQ attive
 */
export function useRqAllocation() {
  const [data, setData] = useState<RqAllocationData>({
    availablePagopa: [],
    availableRq: [],
    loading: true
  });

  const { toast } = useToast();

  const loadAllocationData = async () => {
    setData(prev => ({ ...prev, loading: true, error: undefined }));

    try {
      // SICUREZZA: Verifica autenticazione
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Utente non autenticato');
      }

      // Strategia difensiva: prova prima con has_links, poi fallback intelligente
      let pagopaData: any[] = [];
      
      try {
        // 1) Prova con il filtro desiderato (allocatable_cents > 0 OR has_links = true)
        const res = await supabase
          .from('v_pagopa_allocations')
          .select('*')
          .eq('owner_uid', user.id) // SICUREZZA: filtro per utente
          .or('allocatable_cents.gt.0,has_links.eq.true')
          .order('pagopa_number');
        
        if (res.error) {
          // Fallback intelligente: solo se errore di colonna mancante
          const msg = (res.error.message || '').toLowerCase();
          const isMissingColumn = msg.includes('has_links') || 
                                 msg.includes('column') || 
                                 msg.includes('unknown') ||
                                 msg.includes('does not exist');
          
          if (!isMissingColumn) {
            throw res.error; // Altri errori non vengono mascherati
          }
          throw new Error('missing_column'); // Trigger fallback
        }
        
        pagopaData = res.data || [];
      } catch (e: any) {
        if (e.message !== 'missing_column') throw e;
        
        // 2) Fallback: carica solo PagoPA con quota disponibile
        const allocRes = await supabase
          .from('v_pagopa_allocations')
          .select('*')
          .eq('owner_uid', user.id) // SICUREZZA: filtro per utente
          .gt('allocatable_cents', 0)
          .order('pagopa_number');

        if (allocRes.error) throw allocRes.error;
        pagopaData = allocRes.data || [];

        // 3) Recupera PagoPA linkate (per editing anche con allocazione = 0)
        const { data: linkRows } = await supabase
          .from('riam_quater_links')
          .select('pagopa_id')
          .limit(5000); // Performance: limite ragionevole

        if (linkRows?.length) {
          const linkedIds = [...new Set(linkRows.map(r => r.pagopa_id))]
            .filter(id => !pagopaData.some(p => p.pagopa_id === id));

          if (linkedIds.length) {
            const { data: extra } = await supabase
              .from('v_pagopa_allocations')
              .select('*')
              .eq('owner_uid', user.id) // SICUREZZA: filtro per utente
              .in('pagopa_id', linkedIds);

            if (extra?.length) {
              // Deduplicazione e ordinamento stabile
              const combined = [...pagopaData, ...extra];
              const map = new Map(combined.map(r => [r.pagopa_id, r]));
              pagopaData = Array.from(map.values())
                .sort((a, b) => String(a.pagopa_number || '').localeCompare(String(b.pagopa_number || '')));
            }
          }
        }
      }

      // Carica RQ attive dalla vista con i campi in cents
      const { data: rqData, error: rqError } = await supabase
        .from('v_rateations_with_kpis')
        .select('id, number, taxpayer_name, quater_total_due_cents')
        .eq('owner_uid', user.id) // SICUREZZA: filtro per utente
        .eq('is_quater', true)
        .neq('status', 'INTERROTTA')
        .order('number');

      if (rqError) throw rqError;

      // Mappa i dati nel formato giusto
      const availablePagopa: PagopaForAllocation[] = (pagopaData || []).map(p => ({
        id: p.pagopa_id,
        number: p.pagopa_number,
        taxpayer_name: p.taxpayer_name,
        allocatable_cents: Number(p.allocatable_cents || 0),
        residual_cents: Number(p.residual_cents || 0)
      }));

      const availableRq: RqForAllocation[] = (rqData || []).map(r => ({
        id: r.id,
        number: r.number,
        taxpayer_name: r.taxpayer_name,
        total_cents: Number(r.quater_total_due_cents || 0) // Already in cents
      }));

      setData({
        availablePagopa,
        availableRq,
        loading: false
      });

    } catch (error: any) {
      console.error('Error loading allocation data:', error);
      setData(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Errore nel caricamento dati'
      }));
      
      toast({
        title: 'Errore caricamento',
        description: 'Impossibile caricare i dati per l\'allocazione',
        variant: 'destructive'
      });
    }
  };

  // Carica dati all'avvio
  useEffect(() => {
    loadAllocationData();
  }, []);

  // Funzione per ricaricare i dati (dopo successful allocation)
  const reload = () => {
    loadAllocationData();
    
    // Trigger event per refresh KPI in altre parti dell'app
    window.dispatchEvent(new CustomEvent('rateations:reload-kpis'));
  };

  return {
    ...data,
    reload
  };
}