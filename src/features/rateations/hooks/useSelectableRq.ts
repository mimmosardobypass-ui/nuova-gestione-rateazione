import * as React from 'react';
import { fetchSelectableRqForPagopa, RqLight } from '@/integrations/supabase/api/rq';

export function useSelectableRq(
  pagopaId: number | null,
  allRq: RqLight[],
  linkedRqIds: number[]
) {
  const [data, setData] = React.useState<RqLight[]>(allRq);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!pagopaId) {
        setData(allRq);
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
  }, [pagopaId, allRq, linkedRqIds.join(',')]);

  return { selectableRq: data, loading };
}