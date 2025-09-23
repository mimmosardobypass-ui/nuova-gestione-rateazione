import { useState, useCallback, useEffect, useRef } from "react";
import { useOnline } from "@/hooks/use-online";
import type { RateationRow } from "@/features/rateations/types";
import { supabase } from "@/integrations/supabase/client-resilient";

interface UseAllRateationsReturn {
  rows: RateationRow[];
  loading: boolean;
  error: string | null;
  online: boolean;
}

const CACHE_KEY = "all_rateations_cache_v1";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface CacheData {
  rows: RateationRow[];
  timestamp: number;
  userId: string;
}

/**
 * Hook to fetch ALL rateations without any filters for KPI calculations
 * Used specifically for Quater saving calculations that need complete dataset
 */
export const useAllRateations = (): UseAllRateationsReturn => {
  const [rows, setRows] = useState<RateationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const online = useOnline();
  const currentUserIdRef = useRef<string | null>(null);

  // Cache management
  const saveToCache = useCallback((data: RateationRow[], userId: string) => {
    try {
      const cacheData: CacheData = {
        rows: data,
        timestamp: Date.now(),
        userId,
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    } catch (err) {
      console.warn("Failed to save to cache:", err);
    }
  }, []);

  const loadFromCache = useCallback((userId: string): RateationRow[] | null => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) return null;
      
      const cacheData: CacheData = JSON.parse(cached);
      const isExpired = Date.now() - cacheData.timestamp > CACHE_TTL;
      const isWrongUser = cacheData.userId !== userId;
      
      if (isExpired || isWrongUser) {
        localStorage.removeItem(CACHE_KEY);
        return null;
      }
      
      return cacheData.rows;
    } catch (err) {
      console.warn("Failed to load from cache:", err);
      return null;
    }
  }, []);

  const clearCache = useCallback(() => {
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch (err) {
      console.warn("Failed to clear cache:", err);
    }
  }, []);

  const loadData = useCallback(async () => {
    if (!online) {
      setError("Offline - impossibile caricare i dati");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        throw sessionError;
      }
      
      if (!session?.user) {
        setLoading(false);
        setRows([]);
        clearCache();
        return;
      }

      const userId = session.user.id;
      currentUserIdRef.current = userId;

      // Try to load from cache first
      const cachedData = loadFromCache(userId);
      if (cachedData && cachedData.length > 0) {
        setRows(cachedData);
        setLoading(false);
      }

      if (!supabase) {
        setError("Database non disponibile");
        setLoading(false);
        return;
      }

      // Fetch ALL rateations without filters (including RQ, estinte, decadute, etc.)
      const { data: rateations, error: rateationsError } = await supabase
        .from('v_rateations_with_kpis')
        .select('*')
        .eq('owner_uid', userId)
        .order('created_at', { ascending: false });
      
      if (rateationsError) {
        throw rateationsError;
      }

      // Helper function to convert cents to euros
      const centsToEuro = (v?: number) => Math.max(0, (v ?? 0)) / 100;
      
      // Map view results to UI types
      const finalRows: RateationRow[] = (rateations || []).map(r => ({
        id: String(r.id),
        numero: r.number || "",
        tipo: r.tipo || "N/A",
        contribuente: r.taxpayer_name || "",
        
        // Amounts in euros for compatibility with stats-utils
        importoTotale: centsToEuro(r.total_amount_cents),
        importoPagato: centsToEuro(r.paid_amount_cents),
        importoRitardo: centsToEuro(r.overdue_amount_cents),
        residuo: centsToEuro(r.residual_amount_cents),
        residuoEffettivo: centsToEuro(r.residual_effective_cents),
        
        // Basic counts
        rateTotali: r.rate_totali || 0,
        ratePagate: r.rate_pagate || 0,
        rateNonPagate: (r.rate_totali || 0) - (r.rate_pagate || 0),
        rateInRitardo: r.unpaid_overdue_today || 0,
        ratePaidLate: 0,
        
        // Metadata
        status: r.status || 'attiva',
        created_at: r.created_at,
        updated_at: r.updated_at,
        is_f24: Boolean(r.is_f24),
        type_id: Number(r.type_id),
        type_name: r.tipo || 'N/A',
        
        // Quater fields (mapped from database)
        is_quater: Boolean(r.is_quater),
        original_total_due_cents: r.original_total_due_cents || 0,
        quater_total_due_cents: r.quater_total_due_cents || 0,
        
        // PagoPA fields
        is_pagopa: !!r.is_pagopa,
        unpaid_overdue_today: r.unpaid_overdue_today || 0,
        unpaid_due_today: r.unpaid_due_today || 0,
        max_skips_effective: r.max_skips_effective ?? 8,
        skip_remaining: r.skip_remaining ?? 8,
        at_risk_decadence: !!r.at_risk_decadence,
        
        // Migration fields
        debts_total: r.debts_total || 0,
        debts_migrated: r.debts_migrated || 0,
        migrated_debt_numbers: r.migrated_debt_numbers || [],
        remaining_debt_numbers: r.remaining_debt_numbers || [],
        rq_target_ids: r.rq_target_ids || [],
        rq_migration_status: r.rq_migration_status || 'none',
        excluded_from_stats: !!r.excluded_from_stats,
      }));
      
      setRows(finalRows);
      saveToCache(finalRows, userId);
      
    } catch (err) {
      const message = err instanceof Error ? err.message : "Errore sconosciuto";
      setError(message);
      setRows([]);
      clearCache();
    } finally {
      setLoading(false);
    }
  }, [online, loadFromCache, saveToCache, clearCache]);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Event listener for KPI reload
  useEffect(() => {
    const handleReloadKpis = () => {
      clearCache();
      loadData().catch(console.error);
    };
    
    window.addEventListener('rateations:reload-kpis', handleReloadKpis);
    return () => window.removeEventListener('rateations:reload-kpis', handleReloadKpis);
  }, [loadData, clearCache]);

  return {
    rows,
    loading,
    error,
    online,
  };
};