import { useState, useCallback, useEffect, useRef } from "react";
import { useOnline } from "@/hooks/use-online";
import type { RateationRow } from "@/features/rateations/types";
import { supabase } from "@/integrations/supabase/client-resilient";
import { RateationListRowsSchema } from "@/schemas/RateationListRow.schema";
import { mapListRowToUI } from "@/mappers/mapRateationListRow";

interface UseAllRateationsReturn {
  rows: RateationRow[];
  loading: boolean;
  error: string | null;
  online: boolean;
}

import { RATEATIONS_CACHE_KEY, CACHE_TTL } from "@/constants/cache";

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
      localStorage.setItem(RATEATIONS_CACHE_KEY, JSON.stringify(cacheData));
    } catch (err) {
      console.warn("Failed to save to cache:", err);
    }
  }, []);

  const loadFromCache = useCallback((userId: string): RateationRow[] | null => {
    try {
      const cached = localStorage.getItem(RATEATIONS_CACHE_KEY);
      if (!cached) return null;
      
      const cacheData: CacheData = JSON.parse(cached);
      const isExpired = Date.now() - cacheData.timestamp > CACHE_TTL;
      const isWrongUser = cacheData.userId !== userId;
      
      if (isExpired || isWrongUser) {
        localStorage.removeItem(RATEATIONS_CACHE_KEY);
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
      localStorage.removeItem(RATEATIONS_CACHE_KEY);
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

      // Fetch ALL rateations from canonical view with runtime validation
      const { data: rawData, error: rateationsError } = await supabase
        .from('v_rateations_list_ui')
        .select('*')
        .eq('owner_uid', userId)
        .order('id', { ascending: false });
      
      if (rateationsError) {
        throw rateationsError;
      }

      // Runtime validation with Zod (stops schema mismatches immediately)
      const startTime = Date.now();
      const parsed = RateationListRowsSchema.safeParse(rawData ?? []);
      const validationDuration = Date.now() - startTime;

      if (!parsed.success) {
        console.error("[useAllRateations] Schema validation failed:", parsed.error.flatten());
        
        // Log validation error for observability
        import("@/utils/observability").then(({ logValidationError }) => {
          logValidationError({
            userId,
            error: JSON.stringify(parsed.error.flatten()),
            timestamp: Date.now(),
            context: { rowCount: rawData?.length ?? 0, validationDuration }
          });
        });

        // Safe fallback: no rows to prevent inconsistent UI data
        setRows([]);
        setLoading(false);
        return;
      }

      // Centralized, type-safe mapping
      const finalRows = parsed.data.map(mapListRowToUI);
      
      // Debug: Log final mapped data  
      if (finalRows.length > 0) {
        const firstMapped = finalRows[0];
        console.log("🔍 After validated mapping - first row monetary fields:", {
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