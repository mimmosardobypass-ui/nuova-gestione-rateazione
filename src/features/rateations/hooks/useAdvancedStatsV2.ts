import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client-resilient";
import type { StatsV2Response, StatsV2Params } from "../types/advStats";
import { useSearchParams } from "react-router-dom";

// URL state management helper
function useUrlState() {
  const [sp, setSp] = useSearchParams();
  const set = (k: string, v: string | null) => {
    const nxt = new URLSearchParams(sp);
    if (v === null) nxt.delete(k); else nxt.set(k, v);
    setSp(nxt, { replace: true });
  };
  return { sp, set };
}

interface UseAdvancedStatsV2Result {
  data: StatsV2Response | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useAdvancedStatsV2(params: StatsV2Params): UseAdvancedStatsV2Result {
  // ——— URL state sync (tipologie, groupBy, includeInterrupted) ———
  const { sp, set } = useUrlState();
  
  useEffect(() => {
    set("types", params.types.length ? params.types.join(",") : null);
    set("gb", params.groupBy);
    set("incInt", params.includeInterrupted ? "1" : null);
    if (params.dateFrom) set("from", params.dateFrom); else set("from", null);
    if (params.dateTo) set("to", params.dateTo); else set("to", null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.types, params.groupBy, params.includeInterrupted, params.dateFrom, params.dateTo]);

  // ——— State ———
  const [data, setData] = useState<StatsV2Response | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);

  // ——— RPC payload ———
  const payload = useMemo(()=>({
    p_owner: null, // null = tutti gli utenti; per filtrare per user: auth.uid()
    p_types: params.types.length ? params.types : null,
    p_status: null,
    p_include_interrupted: params.includeInterrupted,
    p_date_from: params.dateFrom ?? null,
    p_date_to: params.dateTo ?? null,
    p_group_by: params.groupBy
  }), [params]);

  // ——— Cache in-memory per navigazioni interne ———
  const key = JSON.stringify(payload);
  const cache = (window as any).__stats_v2_cache ?? ((window as any).__stats_v2_cache = new Map<string, StatsV2Response>());

  // ——— Load function ———
  const load = async () => {
    setLoading(true); 
    setError(null);
    
    // Cache hit
    if (cache.has(key)) { 
      console.log('[useAdvancedStatsV2] Cache hit:', key);
      setData(cache.get(key)); 
      setLoading(false); 
      return; 
    }
    
    // Chiamata RPC
    console.log('[useAdvancedStatsV2] RPC call with args:', payload);
    const { data: json, error: rpcError } = await supabase.rpc("stats_v2", payload);
    
    if (rpcError) {
      console.error('[useAdvancedStatsV2] RPC error:', rpcError);
      setError(rpcError.message);
      setLoading(false);
      return;
    }
    
    console.log('[useAdvancedStatsV2] RPC success:', json);
    
    // Contratto robusto: garantisci struttura anche se backend ritorna null
    const response: StatsV2Response = {
      totals: json?.totals ?? { total_cents: 0, residual_cents: 0, paid_cents: 0 },
      by_type: Array.isArray(json?.by_type) ? json.by_type : [],
      series: Array.isArray(json?.series) ? json.series : [],
    };
    
    setData(response);
    cache.set(key, response);
    setLoading(false);
  };

  // ——— Effect: load on params change ———
  useEffect(() => {
    let cancelled = false;
    
    (async () => {
      if (cancelled) return;
      await load();
    })();
    
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { data, loading, error, reload: load };
}
