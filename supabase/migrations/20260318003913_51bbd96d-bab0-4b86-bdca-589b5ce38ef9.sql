CREATE OR REPLACE FUNCTION public.get_r5_available_for_pagopa(p_pagopa_id bigint)
RETURNS TABLE(id bigint, number text, taxpayer_name text, quater_total_due_cents bigint)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.number, r.taxpayer_name, r.quater_total_due_cents
  FROM rateations r
  WHERE r.owner_uid = auth.uid()
    AND r.is_quinquies = true
    AND r.is_deleted = false
    AND r.status != 'decaduta'
    AND NOT EXISTS (
      SELECT 1 FROM quinquies_links l
      WHERE l.quinquies_id = r.id AND l.unlinked_at IS NULL
    )
    AND r.id <> p_pagopa_id
  ORDER BY r.number;
$$;