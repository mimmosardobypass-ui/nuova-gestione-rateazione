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

const CACHE_KEY = "all_rateations_cache_v4"; // Updated for corrected canonical view
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

      // Fetch ALL rateations from canonical view with corrected logic
      const { data: rateations, error: rateationsError } = await supabase
        .from('v_rateations_list_ui')
        .select('*')
        .eq('owner_uid', userId)
        .order('id', { ascending: false });
      
      if (rateationsError) {
        throw rateationsError;
      }

      // Helper function for cents to EUR conversion
      const centsToEUR = (cents?: number | null): number => 
        typeof cents === 'number' ? cents / 100 : 0;

      // Simplified mapping using canonical view data (all monetary values already calculated correctly in cents)
      const finalRows: RateationRow[] = (rateations || []).map((r: any) => ({
        id: String(r.id),
        numero: r.number || "",
        tipo: r.tipo || "N/A",
        contribuente: r.taxpayer_name || "",

        importoTotale: centsToEUR(r.total_amount_cents),
        importoPagato: centsToEUR(r.paid_amount_cents),
        importoRitardo: centsToEUR(r.overdue_effective_cents),
        residuo: centsToEUR(r.residual_effective_cents),
        residuoEffettivo: centsToEUR(r.residual_effective_cents),

        rateTotali: Number(r.installments_total || 0),
        ratePagate: Number(r.installments_paid || 0),
        rateNonPagate: Number(r.installments_total || 0) - Number(r.installments_paid || 0),
        rateInRitardo: Number(r.installments_overdue_today || 0),

        status: r.status || "attiva",
        created_at: r.created_at,
        updated_at: r.updated_at,
        is_f24: !!r.is_f24,
        type_id: Number(r.type_id || 0),
        type_name: r.tipo || "N/A",
        ratePaidLate: 0,

        // Quater fields
        is_quater: !!r.is_quater,
        original_total_due_cents: Number(r.original_total_due_cents || 0),
        quater_total_due_cents: Number(r.quater_total_due_cents || 0),

        // PagoPA fields  
        is_pagopa: !!r.is_pagopa,
        unpaid_overdue_today: Number(r.installments_overdue_today || 0),
        unpaid_due_today: 0,
        max_skips_effective: 8,
        skip_remaining: 8,
        at_risk_decadence: false,

        // Migration & flags - defaults for missing fields
        debts_total: 0,
        debts_migrated: 0,
        migrated_debt_numbers: [],
        remaining_debt_numbers: [],
        rq_target_ids: [],
        rq_migration_status: "none",
        excluded_from_stats: false,
      } as RateationRow));
      
      // Debug: Log final mapped data  
      if (finalRows.length > 0) {
        const firstMapped = finalRows[0];
        console.log("🔍 After mapping - first row monetary fields:", {
          numero: firstMapped.numero,
          importoTotale: firstMapped.importoTotale,
          importoPagato: firstMapped.importoPagato,
          importoRitardo: firstMapped.importoRitardo,
          residuo: firstMapped.residuo,
          residuoEffettivo: firstMapped.residuoEffettivo
        });
      }
      
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