import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client-resilient";

export function useF24PagopaCost() {
  const [cost, setCost] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCost = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { data, error: costError } = await supabase
        .from("v_f24_pagopa_cost_per_user")
        .select("cost_eur")
        .eq("owner_uid", user.id)
        .maybeSingle();

      if (costError) {
        console.error("Error fetching F24→PagoPA cost:", costError);
        throw costError;
      }

      setCost(data?.cost_eur ?? 0);
    } catch (e: any) {
      console.error("[F24PagopaCost]", e);
      setError(e.message || "Errore nel caricamento costo F24→PagoPA");
      setCost(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCost();
  }, [loadCost]);

  // Listen for F24 link changes
  useEffect(() => {
    const handleReload = () => loadCost();
    window.addEventListener('rateations:reload-kpis', handleReload);
    window.addEventListener('f24:link-changed', handleReload);
    
    return () => {
      window.removeEventListener('rateations:reload-kpis', handleReload);
      window.removeEventListener('f24:link-changed', handleReload);
    };
  }, [loadCost]);

  return { cost, loading, error, reload: loadCost };
}
