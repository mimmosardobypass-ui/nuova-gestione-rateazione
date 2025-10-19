import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface F24LinkedPagopa {
  pagopa_id: number;
  pagopa_number: string;
  pagopa_taxpayer: string | null;
  maggiorazione_allocata_cents: number;
}

/**
 * Hook per recuperare le informazioni della PagoPA collegata a un F24
 */
export function useF24LinkedPagopa(f24Id: number) {
  const [data, setData] = useState<F24LinkedPagopa | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLink = async () => {
      setLoading(true);
      
      try {
        const { data: linkData, error } = await supabase
          .from('v_f24_pagopa_maggiorazione')
          .select('pagopa_id, pagopa_number, pagopa_taxpayer, maggiorazione_allocata_cents')
          .eq('f24_id', f24Id)
          .maybeSingle();

        if (error) {
          console.error('[useF24LinkedPagopa] Error:', error);
          setData(null);
        } else {
          setData(linkData);
        }
      } catch (err) {
        console.error('[useF24LinkedPagopa] Exception:', err);
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    loadLink();
  }, [f24Id]);

  return { data, loading };
}
