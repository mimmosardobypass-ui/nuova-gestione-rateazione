import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Cache in-memory a livello modulo per prevenire N+1
const cache = new Map<number, number>();

/**
 * Invalida la cache per un singolo pagopaId o per tutta la cache
 * Utilizzato dopo migrazione/rollback per aggiornare i contatori
 */
export function invalidatePagopaRqCache(pagopaId?: number) {
  if (pagopaId !== undefined) {
    cache.delete(pagopaId);
  } else {
    cache.clear();
  }
}

/**
 * Hook per contare le RQ collegate attive a una PagoPA
 * 
 * @param pagopaId - ID numerico della PagoPA (o undefined per non fare fetch)
 * @returns { count: number | null, loading: boolean }
 * 
 * Query leggera: count-only con head=true (nessun download di righe)
 * Cache: in-memory a livello modulo, previene query duplicate
 * Errori: ritorna null (UI mostrerà "— RQ")
 */
export function usePagopaLinkedRqCount(pagopaId?: number) {
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(!!pagopaId);

  useEffect(() => {
    if (!pagopaId) {
      setCount(null);
      setLoading(false);
      return;
    }

    // Check cache first
    if (cache.has(pagopaId)) {
      setCount(cache.get(pagopaId)!);
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        // Query leggera: solo count, nessun download righe
        const { count: fetchedCount, error } = await supabase
          .from('riam_quater_links')
          .select('id', { count: 'exact', head: true })
          .eq('pagopa_id', pagopaId)
          .is('unlinked_at', null);

        if (!cancelled) {
          if (error) {
            console.error('[usePagopaLinkedRqCount] Error for pagopaId', pagopaId, error);
            setCount(null);
          } else {
            const finalCount = fetchedCount ?? 0;
            cache.set(pagopaId, finalCount);
            setCount(finalCount);
          }
          setLoading(false);
        }
      } catch (err) {
        console.error('[usePagopaLinkedRqCount] Unexpected error:', err);
        if (!cancelled) {
          setCount(null);
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pagopaId]);

  return { count, loading };
}
