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

const CACHE_KEY = "all_rateations_cache_v2";
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

      // Fetch ALL rateations from canonical view
      const { data: rateations, error: rateationsError } = await supabase
        .from('v_rateations_list_ui')
        .select('*')
        .eq('owner_uid', userId)
        .order('created_at', { ascending: false });
      
      if (rateationsError) {
        throw rateationsError;
      }

      // Debug: Log raw data from view
      console.log("🔍 Raw data from v_rateations_list_ui:", rateations?.slice(0, 2));
      
      if (rateations && rateations.length > 0) {
        const firstRow = rateations[0];
        console.log("🔍 First row monetary fields:", {
          total_amount_cents: firstRow.total_amount_cents,
          paid_amount_cents: firstRow.paid_amount_cents,
          overdue_effective_cents: firstRow.overdue_effective_cents,  
          residual_effective_cents: firstRow.residual_effective_cents,
          number: firstRow.number
        });
      }

      // Helpers robusti
      const toNum = (v: any): number | undefined => {
        if (v === null || v === undefined) return undefined;
        if (typeof v === "string" && v.trim() === "") return undefined;
        const n = typeof v === "string" ? Number(v) : v;
        return Number.isFinite(n) ? n : undefined;
      };

      type Unit = "cents" | "euro";
      type Candidate = { key: string; unit: Unit };

      /** Ritorna number in EURO se trova un candidato, altrimenti undefined */
      const pickMoneyEURMaybe = (row: any, candidates: Candidate[]): number | undefined => {
        for (const c of candidates) {
          const raw = row[c.key];
          const n = toNum(raw);
          if (n === undefined) continue;
          return c.unit === "cents" ? n / 100 : n;
        }
        return undefined;
      };

      /** Comodità: elenchi di alias in cents/euro */
      const moneyMaybe = (row: any, cents: string[], euros: string[]) =>
        pickMoneyEURMaybe(
          row,
          [
            ...cents.map((k) => ({ key: k, unit: "cents" as const })),
            ...euros.map((k) => ({ key: k, unit: "euro" as const })),
          ]
        );

      const finalRows: RateationRow[] = (rateations || []).map((r: any) => {
        // 1) Totale
        const totalEUR =
          moneyMaybe(r,
            ["total_amount_cents", "total_due_cents", "dovuto_cents"],
            ["total_amount", "total_due", "dovuto", "importo_totale"]
          ) ?? 0;

        // 2) Candidati Pagato
        let paidEUR = moneyMaybe(
          r,
          ["paid_amount_cents", "total_paid_cents", "paid_cents", "paid_effective_cents"],
          ["paid_amount", "total_paid", "paid_effective", "importo_pagato"]
        ); // può essere undefined o 0 valido

        // 3) Candidati Residuo (effettivo e lordo)
        let residEffEUR = moneyMaybe(
          r,
          ["residual_effective_cents"],
          ["residual_effective", "residuo_effettivo"]
        );
        let residGrossEUR = moneyMaybe(
          r,
          ["residual_amount_cents", "residual_gross_cents"],
          ["residual_amount", "residual_gross", "residuo"]
        );

        // 4) Derivazioni **con sentinelle**
        //   - Se NON ho paid ma ho un residuo → paid = total - residuo
        const residForPaid = residEffEUR ?? residGrossEUR;
        if (paidEUR === undefined && residForPaid !== undefined)
          paidEUR = Math.max(0, totalEUR - residForPaid);

        //   - Se NON ho residui ma ho paid → residui = total - paid
        if (residEffEUR === undefined && paidEUR !== undefined)
          residEffEUR = Math.max(0, totalEUR - paidEUR);
        if (residGrossEUR === undefined && paidEUR !== undefined)
          residGrossEUR = Math.max(0, totalEUR - paidEUR);

        // 5) In ritardo (preferisci effettivo)
        const overdueEUR =
          moneyMaybe(
            r,
            ["overdue_effective_cents", "overdue_amount_cents", "overdue_gross_cents", "unpaid_overdue_amount_cents"],
            ["overdue_effective", "overdue_amount", "overdue_gross", "importo_in_ritardo"]
          ) ?? 0;

        // 6) Scelte UI: lista = vista operativa
        const residuoEUR = (residEffEUR ?? residGrossEUR ?? 0);
        const pagatoEUR = (paidEUR ?? Math.max(0, totalEUR - residuoEUR));

        return {
          id: String(r.id),
          numero: r.number || r.numero || "",
          tipo: r.tipo || "N/A",
          contribuente: r.taxpayer_name || r.contribuente || "",

          importoTotale: totalEUR,
          importoPagato: pagatoEUR,
          importoRitardo: overdueEUR,
          residuo: residuoEUR,
          residuoEffettivo: residEffEUR ?? residuoEUR,

          rateTotali: Number(r.rate_totali ?? r.installments_total ?? 0),
          ratePagate: Number(r.rate_pagate ?? r.installments_paid ?? 0),
          rateNonPagate:
            Number(r.rate_totali ?? r.installments_total ?? 0) -
            Number(r.rate_pagate ?? r.installments_paid ?? 0),
          rateInRitardo: Number(r.unpaid_overdue_today ?? r.installments_overdue ?? 0),

          status: r.status || "attiva",
          created_at: r.created_at,
          updated_at: r.updated_at,
          is_f24: !!r.is_f24,
          type_id: Number(r.type_id ?? 0),
          type_name: r.tipo || "N/A",
          ratePaidLate: 0,

          // Quater
          is_quater: !!r.is_quater,
          original_total_due_cents: Number(r.original_total_due_cents ?? 0),
          quater_total_due_cents: Number(r.quater_total_due_cents ?? 0),

          // PagoPA misc - defaults for missing fields
          is_pagopa: !!r.is_pagopa,
          unpaid_overdue_today: Number(r.unpaid_overdue_today ?? r.installments_overdue ?? 0),
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
        } as RateationRow;
      });
      
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