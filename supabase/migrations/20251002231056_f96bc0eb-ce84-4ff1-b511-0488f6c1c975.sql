-- Migliora get_rq_available_for_pagopa: esclude RQ già collegate
CREATE OR REPLACE FUNCTION public.get_rq_available_for_pagopa(p_pagopa_id bigint)
RETURNS TABLE(
  id bigint,
  number text,
  taxpayer_name text,
  quater_total_due_cents bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT
    r.id,
    r.number,
    r.taxpayer_name,
    r.quater_total_due_cents
  FROM rateations r
  WHERE
    r.owner_uid = auth.uid()
    AND r.is_quater = true
    AND r.status != 'decaduta'
    AND NOT EXISTS (
      SELECT 1
      FROM riam_quater_links l
      WHERE l.riam_quater_id = r.id
        AND l.unlinked_at IS NULL
    )
    AND r.id <> p_pagopa_id
  ORDER BY r.number;
$$;

-- Vincolo: Una RQ può avere AL MASSIMO 1 link attivo
CREATE UNIQUE INDEX IF NOT EXISTS uq_rq_active_link
ON riam_quater_links (riam_quater_id)
WHERE unlinked_at IS NULL;