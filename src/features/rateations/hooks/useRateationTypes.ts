import { useState, useCallback } from "react";
import { toast } from "@/hooks/use-toast";
import type { RateationType } from "../types";
import { fetchRateationTypes, addRateationType } from "../api/rateations";

export const useRateationTypes = () => {
  const [types, setTypes] = useState<RateationType[]>([]);
  const [loading, setLoading] = useState(false);

  const loadTypes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchRateationTypes();
      setTypes(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Errore nel caricamento tipi";
      toast({
        title: "Errore",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const addNewType = useCallback(async () => {
    const name = prompt("Nome del nuovo tipo:");
    if (!name?.trim()) return;

    try {
      const newType = await addRateationType(name.trim());
      setTypes(prev => [...prev, newType]);
      toast({
        title: "Tipo aggiunto",
        description: `Tipo "${name}" aggiunto con successo`,
      });
      return newType;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Errore nell'aggiunta del tipo";
      toast({
        title: "Errore",
        description: message,
        variant: "destructive",
      });
    }
  }, []);

  return {
    types,
    loading,
    loadTypes,
    addNewType,
  };
};