

## Fix: Deleted R5 rateations appearing in migration dialog

### Root Cause
The `get_r5_available_for_pagopa` RPC does not filter out soft-deleted rateations (`is_deleted = true`). IDs 66 and 67 have `is_deleted = true` but still appear.

### Solution
Single DB migration to update the RPC, adding `AND r.is_deleted = false` to the WHERE clause.

```sql
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
```

No frontend changes needed. After this fix, only `N.1Quinquies` (id 68) will appear.

