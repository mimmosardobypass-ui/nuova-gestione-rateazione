import { useState, useCallback, useEffect, useRef } from "react";
import { toast } from "@/hooks/use-toast";
import { useOnline } from "@/hooks/use-online";
import type { RateationRow } from "../types";
import { supabase, safeSupabaseOperation } from "@/integrations/supabase/client-resilient";

interface UseRateationsReturn {
  rows: RateationRow[];
  loading: boolean;
  error: string | null;
  online: boolean;
  info: {
    count: number;
    lastUpdatedAt: string | null;
  };
  loadData: () => Promise<void>;
  refresh: () => Promise<void>;
  handleDelete: (id: string, debouncedReloadStats?: () => void) => Promise<void>;
  deleting: string | null;
  addRateation: (data: any) => Promise<void>;
  updateRateation: (id: string, updates: any) => Promise<void>;
  deleteRateation: (id: string) => Promise<void>;
}

const CACHE_KEY = "rateations_cache_v3_kpis"; // Updated for KPI alignment
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface CacheData {
  rows: RateationRow[];
  timestamp: number;
  userId: string;
}

export const useRateations = (): UseRateationsReturn => {
  const [rows, setRows] = useState<RateationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const online = useOnline();
  const channelRef = useRef<any>(null);
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
      
      // Validate cache has KPI fields (including migration fields)
      const hasKpiFields = Array.isArray(cacheData.rows) && cacheData.rows.every(r => 
        r && 'skip_remaining' in r && 'unpaid_overdue_today' in r && 'max_skips_effective' in r &&
        'rq_migration_status' in r && 'excluded_from_stats' in r
      );
      
      if (isExpired || isWrongUser || !hasKpiFields) {
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

  // Sanity check function to validate KPI consistency post-mapping
  const sanityCheckRows = useCallback((rows: RateationRow[]) => {
    // Filter out migrated rows for consistency check
    const activeRows = rows.filter(r => !r.excluded_from_stats);
    
    activeRows.forEach(r => {
      const max = r.max_skips_effective ?? 8;
      const overdue = r.unpaid_overdue_today ?? 0;
      const remaining = r.skip_remaining ?? 8;
      const expected = Math.max(0, Math.min(max, max - overdue));
      
      if (r.is_pagopa && remaining !== expected) {
        console.warn('[KPI-MISMATCH]', { 
          id: r.id, 
          tipo: r.tipo, 
          overdue, 
          remaining, 
          expected, 
          max,
          message: `Skip remaining (${remaining}) doesn't match expected (${expected})`
        });
      }
      
      if (r.is_pagopa && (r.at_risk_decadence === true) !== (overdue >= max)) {
        console.warn('[KPI-BANNER-MISMATCH]', { 
          id: r.id, 
          overdue, 
          max, 
          at_risk_decadence: r.at_risk_decadence,
          message: `Banner risk flag (${r.at_risk_decadence}) doesn't match KPI calculation (${overdue >= max})`
        });
      }
    });
  }, []);

  const loadData = useCallback(async () => {
    console.debug("[useRateations] loadData called - online:", online);
    if (!online) {
      setError("Offline - impossibile caricare i dati");
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);
    console.debug("[useRateations] Starting data load...");

    try {
      // Get current session using getSession (more reliable than getUser)
      console.debug("[useRateations] Starting loadData...");
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        console.error("[useRateations] Session error:", sessionError);
        throw sessionError;
      }
      
      if (!session?.user) {
        console.warn("[useRateations] User not authenticated, skipping data load");
        setLoading(false);
        setRows([]);
        clearCache();
        return;
      }

      const userId = session.user.id;
      currentUserIdRef.current = userId;
      console.debug("[useRateations] Loading data for user:", userId);

      // Try to load from cache first for instant display
      const cachedData = loadFromCache(userId);
      if (cachedData && cachedData.length > 0) {
        console.debug("[useRateations] Loaded from cache:", cachedData.length, "rows");
        setRows(cachedData);
        setLoading(false); // Show cached data immediately
      }

      if (!supabase) {
        console.warn("[useRateations] Supabase client not available");
        setError("Database non disponibile");
        setLoading(false);
        return;
      }

      // Fetch rateations with pre-calculated KPIs from the canonical view
      const { data: rateations, error: rateationsError } = await supabase
        .from('v_rateations_with_kpis')
        .select('*')
        .eq('owner_uid', userId)
        .order('created_at', { ascending: false });
      
      console.debug("[useRateations] View response:", { rateations, error: rateationsError });
      if (rateationsError) {
        console.error("[useRateations] View fetch error:", rateationsError);
        throw rateationsError;
      }

      if ((rateations || []).length === 0) {
        console.warn("[useRateations] No rateations found for user. Check owner_uid backfill/RLS.");
        const emptyResult: RateationRow[] = [];
        setRows(emptyResult);
        saveToCache(emptyResult, userId);
        setLastUpdatedAt(new Date().toISOString());
        return;
      }

      // Map view results directly to UI types (all KPIs pre-calculated with Europe/Rome timezone)
      const finalRows: RateationRow[] = (rateations || []).map(r => ({
        id: String(r.id),
        numero: r.number || "",
        tipo: r.tipo || "N/A",
        contribuente: r.taxpayer_name || "",
        
        // Use cents-based values for precision (main amounts)
        importoTotale: (r.total_amount_cents || 0) / 100,
        importoPagato: (r.paid_amount_cents || 0) / 100,
        importoRitardo: (r.overdue_amount_cents || 0) / 100,
        residuo: ((r.total_amount_cents || 0) - (r.paid_amount_cents || 0)) / 100,
        
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
        
        // PagoPA KPIs from DB - robust fallbacks to avoid "0/8" display issues
        is_pagopa: !!r.is_pagopa, // Use DB-calculated field directly
        unpaid_overdue_today: r.unpaid_overdue_today || 0,
        unpaid_due_today: r.unpaid_due_today || 0,
        max_skips_effective: r.max_skips_effective ?? 8, // Default 8 if missing
        skip_remaining: r.skip_remaining ?? 8, // Default 8 prevents false "0/8" warnings
        at_risk_decadence: !!r.at_risk_decadence,
        
        // Migration fields from DB
        debts_total: r.debts_total || 0,
        debts_migrated: r.debts_migrated || 0,
        migrated_debt_numbers: r.migrated_debt_numbers || [],
        remaining_debt_numbers: r.remaining_debt_numbers || [],
        rq_target_ids: r.rq_target_ids || [],
        rq_migration_status: r.rq_migration_status || 'none',
        excluded_from_stats: !!r.excluded_from_stats,
      }));
      
      // Debug logging for first 10 rows to verify KPIs are correctly read from canonical view
      console.group('🔍 PagoPA KPI Debug - DB Source Truth (Europe/Rome timezone)');
      console.table(finalRows.slice(0, 10).map(x => ({
        id: x.id,
        numero: x.numero,
        tipo: x.tipo,
        is_pagopa: x.is_pagopa,
        in_ritardo: x.unpaid_overdue_today,
        scadenti_oggi: x.unpaid_due_today,
        salti: `${x.skip_remaining}/${x.max_skips_effective}`,
        rischio_decadenza: x.at_risk_decadence ? '⚠️ SI' : '✅ NO'
      })));
      console.groupEnd();
      
      // Sanity check KPI consistency
      sanityCheckRows(finalRows);
      
      if (controller.signal.aborted) return;
      
      setRows(finalRows);
      saveToCache(finalRows, userId);
      setLastUpdatedAt(new Date().toISOString());
      console.debug("[useRateations] processed rows:", finalRows.length);
      
    } catch (err) {
      if (controller.signal.aborted || (err instanceof Error && err.message === 'AbortError')) {
        console.debug('[ABORT] useRateations loadData');
        return;
      }
      const message = err instanceof Error ? err.message : "Errore sconosciuto";
      setError(message);
      setRows([]);
      clearCache();
      toast({
        title: "Errore nel caricamento",
        description: message,
        variant: "destructive",
      });
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [online, loadFromCache, saveToCache, clearCache]);

  const refresh = useCallback(async () => {
    console.log('🔄 [DEBUG] Manual refresh triggered - clearing cache and reloading');
    clearCache();
    await loadData();
  }, [loadData, clearCache]);

  // Debug function to manually clear cache for testing
  const debugClearCache = useCallback(() => {
    console.log('🗑️ [DEBUG] Manual cache clear');
    clearCache();
    // Also clear browser cache for this session
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }, [clearCache]);

  // Expose debug function globally for testing
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).debugClearRateationsCache = debugClearCache;
      console.log('🔧 [DEBUG] Debug function available: window.debugClearRateationsCache()');
    }
  }, [debugClearCache]);

  const handleDelete = useCallback(async (id: string, debouncedReloadStats?: () => void) => {
    if (!online) {
      toast({
        title: "Offline",
        description: "Impossibile eliminare offline",
        variant: "destructive",
      });
      return;
    }

    if (deleting) {
      toast({
        title: "Operazione in corso",
        description: "Attendi il completamento dell'eliminazione",
        variant: "destructive",
      });
      return;
    }

    if (!confirm("Sei sicuro di voler eliminare questa rateazione e tutte le sue rate?")) {
      return;
    }

    setDeleting(id);
    try {
      // Delete installments first
      const { error: installmentsError } = await supabase
        .from("installments")
        .delete()
        .eq("rateation_id", id);

      if (installmentsError) throw installmentsError;

      // Delete rateation
      const { error: rateationError } = await supabase
        .from("rateations")
        .delete()
        .eq("id", id);

      if (rateationError) throw rateationError;

      toast({
        title: "Eliminata",
        description: "Rateazione eliminata con successo",
      });
      
      clearCache();
      await loadData();
      debouncedReloadStats?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Errore nell'eliminazione";
      toast({
        title: "Errore",
        description: message,
        variant: "destructive",
      });
    } finally {
      setDeleting(null);
    }
  }, [online, loadData, deleting, clearCache]);

  const addRateation = useCallback(async (data: any) => {
    if (!currentUserIdRef.current) {
      throw new Error("User not authenticated");
    }

    const { error } = await supabase
      .from("rateations")
      .insert({ ...data, owner_uid: currentUserIdRef.current });

    if (error) throw error;
    
    clearCache();
    await loadData();
  }, [loadData, clearCache]);

  const updateRateation = useCallback(async (id: string, updates: any) => {
    const { error } = await supabase
      .from("rateations")
      .update(updates)
      .eq("id", id);

    if (error) throw error;
    
    clearCache();
    await loadData();
  }, [loadData, clearCache]);

  const deleteRateation = useCallback(async (id: string) => {
    await handleDelete(id);
  }, [handleDelete]);

  // Setup Realtime subscription - AFTER initial load
  useEffect(() => {
    if (!currentUserIdRef.current) return;

    console.debug("[useRateations] Setting up Realtime subscription for user:", currentUserIdRef.current);
    
    const channel = supabase
      .channel('rateations-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rateations',
          filter: `owner_uid=eq.${currentUserIdRef.current}`
        },
        (payload) => {
          console.debug("[useRateations] Realtime rateations change:", payload);
          clearCache();
          // Use setTimeout to avoid dependency loops
          setTimeout(() => {
            loadData().catch(console.error);
          }, 100);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'installments'
        },
        (payload) => {
          console.debug("[useRateations] Realtime installments change:", payload);
          clearCache();
          // Use setTimeout to avoid dependency loops
          setTimeout(() => {
            loadData().catch(console.error);
          }, 100);
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        console.debug("[useRateations] Unsubscribing from Realtime");
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []); // NO dependencies to avoid loops

  // Event listener for KPI reload
  useEffect(() => {
    const handleReloadKpis = () => {
      console.debug("[useRateations] KPI reload event received");
      clearCache();
      loadData().catch(console.error);
    };
    
    window.addEventListener('rateations:reload-kpis', handleReloadKpis);
    return () => window.removeEventListener('rateations:reload-kpis', handleReloadKpis);
  }, [loadData, clearCache]);

  // Initial load
  useEffect(() => {
    console.debug("[useRateations] Initial load effect triggered");
    loadData();
  }, [loadData]);

  return {
    rows,
    loading,
    error,
    online,
    info: {
      count: rows.length,
      lastUpdatedAt,
    },
    loadData,
    refresh,
    handleDelete,
    deleting,
    addRateation,
    updateRateation,
    deleteRateation,
  };
};