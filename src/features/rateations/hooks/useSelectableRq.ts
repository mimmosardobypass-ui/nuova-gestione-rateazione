import * as React from 'react';
import { fetchSelectableRqForPagopa, RqLight } from '@/integrations/supabase/api/rq';

/**
 * FASE 3.1: Hook per RQ disponibili (vuoto se non selezioni la PagoPA)
 * Logica semplice, zero ambiguità
 */
export function useSelectableRq(
  pagopaId: number | null,
  allRq: RqLight[],
  linkedRqIds: number[]
) {
  const [data, setData] = React.useState<RqLight[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!pagopaId) { 
        setData([]); // <-- NIENTE RQ se non c'è PagoPA
        return; 
      }
      
      setLoading(true);
      try {
        const selectable = await fetchSelectableRqForPagopa(pagopaId, allRq, linkedRqIds);
        if (!cancelled) setData(selectable);
      } finally { 
        if (!cancelled) setLoading(false); 
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [pagopaId, JSON.stringify(allRq), linkedRqIds.join(',')]);

  return { selectableRq: data, loading };
}