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
      // Carica PagoPA con allocatable > 0
      const { data: pagopaData, error: pagopaError } = await supabase
        .from('v_pagopa_allocations')
        .select('*')
        .gt('allocatable_cents', 0)
        .order('pagopa_number');

      if (pagopaError) throw pagopaError;

      // Carica RQ attive (is_quater = true, status != 'INTERROTTA')
      const { data: rqData, error: rqError } = await supabase
        .from('rateations')
        .select('id, number, taxpayer_name, total_amount')
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
        total_cents: Math.round((r.total_amount || 0) * 100) // Convert to cents
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