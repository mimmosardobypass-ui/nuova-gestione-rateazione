

## Fix: R5 rateations not visible in migration dialog

### Root Cause
The `is_quinquies` flag on existing R5 rateations is `false`. There is a DB trigger `sync_is_quater` that auto-sets `is_quater = true` when the type name contains "QUATER", but **no equivalent trigger exists for `is_quinquies`**. The RPC `get_r5_available_for_pagopa` filters by `is_quinquies = true`, so it returns zero results.

Confirmed via query: rateations id 66, 67, 68 all have `is_quinquies = false` despite being of type "Rottamazione Quinquies".

### Solution

**Single DB migration** with two steps:

1. **Create trigger `sync_is_quinquies`**: Mirrors `sync_is_quater` logic. On INSERT/UPDATE, if the type name contains "QUINQUIES", set `is_quinquies = true`.

2. **Backfill existing rows**: Update all rateations where the type name contains "QUINQUIES" to set `is_quinquies = true`.

No frontend changes needed. After this fix, the `get_r5_available_for_pagopa` RPC will find the R5 rateations and display them in the migration dialog.

### SQL Migration

```sql
-- 1. Trigger function to auto-sync is_quinquies
CREATE OR REPLACE FUNCTION public.sync_is_quinquies()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.type_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM rateation_types
      WHERE id = NEW.type_id
      AND UPPER(COALESCE(name, '')) LIKE '%QUINQUIES%'
    ) THEN
      NEW.is_quinquies := TRUE;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Attach trigger
CREATE TRIGGER trigger_sync_is_quinquies
  BEFORE INSERT OR UPDATE ON rateations
  FOR EACH ROW EXECUTE FUNCTION sync_is_quinquies();

-- 3. Backfill existing R5 rateations
UPDATE rateations
SET is_quinquies = true
WHERE type_id IN (
  SELECT id FROM rateation_types
  WHERE UPPER(COALESCE(name, '')) LIKE '%QUINQUIES%'
)
AND (is_quinquies IS NULL OR is_quinquies = false);
```

### Impact
- Zero risk to existing data (only sets a boolean flag)
- No frontend changes required
- Existing R5 rateations become immediately visible in the migration dialog

