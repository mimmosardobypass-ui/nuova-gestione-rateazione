import { useState, useCallback, useEffect, useRef } from "react";
import { toast } from "@/hooks/use-toast";
import { useOnline } from "@/hooks/use-online";
import type { RateationRow } from "../types";
import { supabase } from "@/integrations/supabase/client";

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
    if (!online) {
      setError("Offline - impossibile caricare i dati");
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    try {
      // Get current session using getSession (more reliable than getUser)
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      
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

      if (controller.signal.aborted) return;

      // 1) Fetch rateations with owner_uid filter
      const t0 = performance.now?.() ?? Date.now();
      const { data: rateations, error: rateationsError } = await supabase
        .from("rateations")
        .select("id, number, type_id, taxpayer_name, created_at")
        .eq("owner_uid", userId);
      const t1 = performance.now?.() ?? Date.now();
      if (rateationsError) throw rateationsError;

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
      const today = new Date(); 
      today.setHours(0, 0, 0, 0);

      // Process each rateation with custom logic
      const processedRows: (RateationRow & { _createdAt: string | null })[] = (rateations || []).map(r => {
        const its = (installments || []).filter(i => i.rateation_id === r.id);

        const rateTotali = its.length;
        const ratePagate = its.filter(i => i.is_paid).length;
        const rateNonPagate = rateTotali - ratePagate;

        // Overdue installments: not paid and past due date
        const rateInRitardo = its.filter(i => {
          if (i.is_paid) return false;
          if (!i.due_date) return false;
          const due = new Date(i.due_date);
          due.setHours(0, 0, 0, 0);
          return due < today;
        }).length;

        // Paid late installments: paid_at > due_date (historical)
        const ratePaidLate = its.filter(i => {
          if (!i.is_paid || !i.due_date || !i.paid_at) return false;
          const due = new Date(i.due_date);
          due.setHours(0, 0, 0, 0);
          const paid = new Date(i.paid_at);
          paid.setHours(0, 0, 0, 0);
          return paid > due;
        }).length;

        const importoTotale = its.reduce((s, i) => s + (i.amount || 0), 0);
        const importoPagato = its.filter(i => i.is_paid).reduce((s, i) => s + (i.amount || 0), 0);
        const importoRitardo = its
          .filter(i => !i.is_paid && i.due_date && new Date(new Date(i.due_date).setHours(0, 0, 0, 0)) < today)
          .reduce((s, i) => s + (i.amount || 0), 0);
        const residuo = importoTotale - importoPagato;

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
    clearCache();
    await loadData();
  }, [loadData, clearCache]);

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

  // Setup Realtime subscription
  useEffect(() => {
    if (!currentUserIdRef.current) return;

    console.debug("[useRateations] Setting up Realtime subscription");
    
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
          loadData();
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
          loadData();
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
  }, [loadData, clearCache]);

  // Initial load
  useEffect(() => {
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