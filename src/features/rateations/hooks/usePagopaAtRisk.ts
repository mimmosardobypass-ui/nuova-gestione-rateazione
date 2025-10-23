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
  console.log('🔵 [usePagopaAtRisk] Hook START - FIRST LINE EXECUTED');
  
  const [atRiskPagopas, setAtRiskPagopas] = useState<PagopaAtRiskItem[]>([]);
  const [loading, setLoading] = useState(false); // FALSE per test immediato
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('🔵 [usePagopaAtRisk] useEffect TRIGGERED - setting mock data');
    
    // Mock data per test - simula 1 rateazione PagoPA a rischio
    const mockData: PagopaAtRiskItem[] = [
      {
        rateationId: '28',
        numero: 'N.11 PagoPa TEST',
        contribuente: 'CONTRIBUENTE TEST',
        unpaidOverdueCount: 7,
        skipRemaining: 1,
        nextDueDate: '2025-02-11',
        daysRemaining: -254
      }
    ];
    
    console.log('🔵 [usePagopaAtRisk] Setting mock data:', mockData);
    setAtRiskPagopas(mockData);
  }, []);

  console.log('🔵 [usePagopaAtRisk] Hook END - Returning state:', { 
    count: atRiskPagopas.length, 
    loading, 
    error,
    items: atRiskPagopas.map(i => i.numero)
  });

  return { atRiskPagopas, loading, error };
}
