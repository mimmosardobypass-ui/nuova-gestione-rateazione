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

      // Helpers robusti
      const toNum = (v: any): number => {
        if (v === null || v === undefined) return 0;
        if (typeof v === "string" && v.trim() === "") return 0;
        const n = typeof v === "string" ? Number(v) : v;
        return Number.isFinite(n) ? n : 0;
      };

      type Unit = "cents" | "euro";
      type Candidate = { key: string; unit: Unit };

      /** Prende il primo campo esistente tra i candidati e lo restituisce in EURO */
      const pickMoneyEUR = (row: any, candidates: Candidate[]): number => {
        for (const c of candidates) {
          const raw = row[c.key];
          if (raw !== null && raw !== undefined) {
            const n = toNum(raw);
            if (!n) continue;
            return c.unit === "cents" ? n / 100 : n; // ← conversione sicura
          }
        }
        return 0;
      };

      /** Comodità: prende tanti possibili alias "cents" e "euro" */
      const moneyPicker = (row: any, cents: string[], euros: string[]) =>
        pickMoneyEUR(
          row,
          [
            ...cents.map((k) => ({ key: k, unit: "cents" as const })),
            ...euros.map((k) => ({ key: k, unit: "euro" as const })),
          ]
        );

      const finalRows: RateationRow[] = (rateations || []).map((r: any) => {
        // 1) Totale (preferisci qualsiasi campo disponibile)
        const totalEUR = moneyPicker(
          r,
          // cents
          ["total_amount_cents", "total_due_cents", "dovuto_cents"],
          // euro
          ["total_amount", "total_due", "dovuto", "importo_totale"]
        );

        // 2) Pagato (fallback + derivazione se manca)
        let paidEUR = moneyPicker(
          r,
          // cents
          ["paid_amount_cents", "total_paid_cents", "paid_cents", "paid_effective_cents"],
          // euro
          ["paid_amount", "total_paid", "paid_effective", "importo_pagato"]
        );

        // 3) Residuo (preferisci effettivo; se assente, gross; se ancora assente, derivato)
        let residualEffEUR = moneyPicker(
          r,
          // cents
          ["residual_effective_cents"],
          // euro
          ["residual_effective", "residuo_effettivo"]
        );
        let residualGrossEUR = moneyPicker(
          r,
          // cents
          ["residual_amount_cents", "residual_gross_cents"],
          // euro
          ["residual_amount", "residual_gross", "residuo"]
        );

        // Derivazioni: se mancano i residui ma ho total/pagato
        if (!residualEffEUR && totalEUR && paidEUR) residualEffEUR = Math.max(0, totalEUR - paidEUR);
        if (!residualGrossEUR && totalEUR && paidEUR) residualGrossEUR = Math.max(0, totalEUR - paidEUR);

        // 4) In ritardo (preferisci effettivo; se assente prendi lordo/oggi)
        const overdueEUR =
          moneyPicker(
            r,
            // cents
            ["overdue_effective_cents", "overdue_amount_cents", "overdue_gross_cents", "unpaid_overdue_amount_cents"],
            // euro
            ["overdue_effective", "overdue_amount", "overdue_gross", "importo_in_ritardo"]
          ) || 0;

        // 5) Campi UI
        const importoTotale = totalEUR;
        const importoPagato = paidEUR;
        const importoRitardo = overdueEUR;
        const residuo = residualEffEUR || residualGrossEUR; // lista = vista operativa

        return {
          id: String(r.id),
          numero: r.number || r.numero || "",
          tipo: r.tipo || "N/A",
          contribuente: r.taxpayer_name || r.contribuente || "",

          // EURO già pronti
          importoTotale,
          importoPagato,
          importoRitardo,
          residuo,
          residuoEffettivo: residualEffEUR || residuo,

          // Contatori
          rateTotali: toNum(r.rate_totali ?? r.installments_total ?? 0),
          ratePagate: toNum(r.rate_pagate ?? r.installments_paid ?? 0),
          rateNonPagate:
            toNum(r.rate_totali ?? r.installments_total ?? 0) -
            toNum(r.rate_pagate ?? r.installments_paid ?? 0),
          rateInRitardo: toNum(r.unpaid_overdue_today ?? r.installments_overdue ?? 0),
          ratePaidLate: 0,

          // Metadati
          status: r.status || "attiva",
          created_at: r.created_at,
          updated_at: r.updated_at,
          is_f24: !!r.is_f24,
          type_id: toNum(r.type_id),
          type_name: r.tipo || "N/A",

          // Quater
          is_quater: !!r.is_quater,
          original_total_due_cents: toNum(r.original_total_due_cents),
          quater_total_due_cents: toNum(r.quater_total_due_cents),

          // PagoPA misc
          is_pagopa: !!r.is_pagopa,
          unpaid_overdue_today: toNum(r.unpaid_overdue_today),
          unpaid_due_today: toNum(r.unpaid_due_today),
          max_skips_effective: r.max_skips_effective ?? 8,
          skip_remaining: r.skip_remaining ?? 8,
          at_risk_decadence: !!r.at_risk_decadence,

          // Migration & flags
          debts_total: toNum(r.debts_total),
          debts_migrated: toNum(r.debts_migrated),
          migrated_debt_numbers: r.migrated_debt_numbers || [],
          remaining_debt_numbers: r.remaining_debt_numbers || [],
          rq_target_ids: r.rq_target_ids || [],
          rq_migration_status: r.rq_migration_status || "none",
          excluded_from_stats: !!r.excluded_from_stats,
        } as RateationRow;
      });
      
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