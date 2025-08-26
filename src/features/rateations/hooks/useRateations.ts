import { useState, useCallback, useEffect, useRef } from "react";
import { toast } from "@/hooks/use-toast";
import { useOnline } from "@/hooks/use-online";
import type { RateationRow } from "../types";
import { supabase, safeSupabaseOperation } from "@/integrations/supabase/client-resilient";
import { calcPagopaKpis, MAX_PAGOPA_SKIPS, toMidnightLocal } from "@/features/rateations/utils/pagopaSkips";

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

const CACHE_KEY = "rateations_cache_v1";
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

      if (controller.signal.aborted) return;
      const t0 = performance.now?.() ?? Date.now();
      console.debug("[useRateations] Fetching rateations for user:", userId);
      const { data: rateations, error: rateationsError } = await supabase
        .from("rateations")
        .select("id, number, type_id, taxpayer_name, created_at")
        .eq("owner_uid", userId);
      const t1 = performance.now?.() ?? Date.now();
      
      console.debug("[useRateations] Raw rateations response:", { rateations, error: rateationsError });
      if (rateationsError) {
        console.error("[useRateations] Rateations fetch error:", rateationsError);
        throw rateationsError;
      }

      const rateationIds = (rateations || []).map(r => r.id);
      console.debug("[useRateations] rateations fetched:", {
        userId,
        count: rateations?.length ?? 0,
        ms: Math.round(t1 - t0),
      });

      if (rateationIds.length === 0) {
        console.warn("[useRateations] No rateations found for user. Check owner_uid backfill/RLS.");
        const emptyResult: RateationRow[] = [];
        setRows(emptyResult);
        saveToCache(emptyResult, userId);
        setLastUpdatedAt(new Date().toISOString());
        return;
      }

      // 2) Fetch installments for user's rateations
      const t2 = performance.now?.() ?? Date.now();
      const { data: installments, error: installmentsError } = await supabase
        .from("installments")
        .select("rateation_id, amount, is_paid, due_date, paid_at")
        .in("rateation_id", rateationIds);
      const t3 = performance.now?.() ?? Date.now();
      if (installmentsError) throw installmentsError;
      console.debug("[useRateations] installments fetched:", {
        count: installments?.length ?? 0,
        ms: Math.round(t3 - t2),
      });

      // 3) Fetch types
      const { data: types, error: typesError } = await supabase
        .from("rateation_types")
        .select("id, name");
      if (typesError) throw typesError;

      const typesMap = Object.fromEntries((types || []).map(t => [t.id, t.name as string]));

      // 4) Timezone-safe today calculation using unified helper
      const todayMid = toMidnightLocal(new Date());

      // Process each rateation with merged KPI data
      const processedRows: (RateationRow & { _createdAt: string | null })[] = (rateations || []).map(r => {
        const its = (installments || []).filter(i => i.rateation_id === r.id);

        const rateTotali = its.length;
        const ratePagate = its.filter(i => i.is_paid).length;
        const rateNonPagate = rateTotali - ratePagate;

        // Overdue installments: not paid and past due date (timezone-safe)
        const rateInRitardo = its.filter(i => {
          if (i.is_paid) return false;
          if (!i.due_date) return false;
          return toMidnightLocal(i.due_date) < todayMid;
        }).length;

        // Paid late installments: paid_at > due_date (historical)
        const ratePaidLate = its.filter(i => {
          if (!i.is_paid || !i.due_date || !i.paid_at) return false;
          return toMidnightLocal(i.paid_at) > toMidnightLocal(i.due_date);
        }).length;

        const importoTotale = its.reduce((s, i) => s + (i.amount || 0), 0);
        const importoPagato = its.filter(i => i.is_paid).reduce((s, i) => s + (i.amount || 0), 0);
        const importoRitardo = its
          .filter(i => !i.is_paid && i.due_date && toMidnightLocal(i.due_date) < todayMid)
          .reduce((s, i) => s + (i.amount || 0), 0);
        const residuo = importoTotale - importoPagato;
        
        // PagoPA KPI calculation using centralized utility
        const isPagoPA = (typesMap[r.type_id] ?? '').toUpperCase() === 'PAGOPA';
        let unpaidOverdueToday: number = 0;
        let skipRemaining: number = MAX_PAGOPA_SKIPS;
        let maxSkipsEffective: number = MAX_PAGOPA_SKIPS;

        // DEBUG: Special logging for rateation #11 (N.11 PagoPa)
        const isRateation11 = r.number === '11' || r.number === 'N.11' || r.number.includes('11');
        if (isRateation11) {
          console.log(`🔍 [DEBUG] Rateation #11 (ID: ${r.id}) analysis:`);
          console.log(`  - Raw rateation data:`, r);
          console.log(`  - Type ID: ${r.type_id}, Type name: "${typesMap[r.type_id]}", isPagoPA: ${isPagoPA}`);
          console.log(`  - Raw installments (${its.length}):`, its);
          console.log(`  - Today midnight:`, todayMid);
          console.log(`  - Rate in ritardo (old logic): ${rateInRitardo}`);
        }

        if (isPagoPA) {
          const installmentLiteData = its.map(i => ({ is_paid: i.is_paid, due_date: i.due_date }));
          
          if (isRateation11) {
            console.log(`  - Installment lite data for PagoPA calc:`, installmentLiteData);
          }
          
          const pagopaResult = calcPagopaKpis(
            installmentLiteData,
            MAX_PAGOPA_SKIPS,
            todayMid
          );
          
          if (isRateation11) {
            console.log(`  - PagoPA calculation result:`, pagopaResult);
          }
          
          unpaidOverdueToday = pagopaResult.unpaidOverdueToday;
          skipRemaining = pagopaResult.skipRemaining;
          maxSkipsEffective = pagopaResult.maxSkips;
          
          if (isRateation11) {
            console.log(`  - Final values: unpaidOverdueToday=${unpaidOverdueToday}, skipRemaining=${skipRemaining}, maxSkips=${maxSkipsEffective}`);
          }
        }

        return {
          id: String(r.id),
          numero: r.number || "",
          tipo: typesMap[r.type_id] || "N/A",
          contribuente: r.taxpayer_name || "",
          importoTotale,
          importoPagato,
          importoRitardo,
          residuo,
          rateTotali,
          ratePagate,
          rateNonPagate,
          rateInRitardo,
          ratePaidLate,
          // Always include PagoPA KPI fields (unified local calculation)
          unpaid_overdue_today: unpaidOverdueToday,
          max_skips_effective: maxSkipsEffective,
          skip_remaining: skipRemaining,
          _createdAt: r.created_at || null,
        };
      });

      // Sort by created_at descending
      processedRows.sort((a, b) => {
        const da = a._createdAt ? new Date(a._createdAt).getTime() : 0;
        const db = b._createdAt ? new Date(b._createdAt).getTime() : 0;
        return db - da;
      });
      
      if (controller.signal.aborted) return;
      
      // Remove auxiliary property and update state
      const finalRows = processedRows.map(({ _createdAt, ...rest }) => rest);
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