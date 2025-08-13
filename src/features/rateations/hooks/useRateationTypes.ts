import { useState, useCallback } from "react";
import { toast } from "@/hooks/use-toast";
import type { RateationType } from "../types";
import { fetchRateationTypes } from "../api/rateations";
import { supabase } from "@/integrations/supabase/client";

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
      console.error("Error loading rateation types:", err);
      toast({
        title: "Errore tipologie",
        description: message,
        variant: "destructive",
      });
      setTypes([]); // Evita stato indefinito
    } finally {
      setLoading(false);
    }
  }, []);

  const addNewType = useCallback(async () => {
    const name = window.prompt("Nome nuovo tipo:");
    if (!name?.trim()) return;
    
    try {
      const { data, error } = await supabase
        .from("rateation_types")
        .insert({ name: name.trim() })
        .select("id, name")
        .single();
        
      if (error) {
        console.error("Error creating rateation type:", error);
        toast({
          title: "Errore",
          description: error.message,
          variant: "destructive",
        });
        return;
      }
      
      const newType = { id: Number(data.id), name: String(data.name) };
      setTypes(prev => [...prev, newType]);
      toast({
        title: "Tipo creato",
        description: `Tipo "${name}" creato con successo`,
      });
      return newType;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Errore nell'aggiunta del tipo";
      console.error("Unexpected error:", err);
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