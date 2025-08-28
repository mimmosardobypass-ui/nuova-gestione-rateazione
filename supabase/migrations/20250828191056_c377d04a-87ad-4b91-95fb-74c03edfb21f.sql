-- 1. Missing RPC functions for diagnostics/repair
CREATE OR REPLACE FUNCTION public.fn_detect_orphaned_migrations()
RETURNS TABLE(
  debt_id uuid,
  issue_type text,             -- 'orphaned_migrated_in' | 'orphaned_migrated_out'
  details jsonb
)
LANGUAGE sql
SECURITY DEFINER
AS $$
WITH mi AS (
  SELECT rateation_id AS target_id, debt_id, target_rateation_id AS source_id
  FROM public.rateation_debts
  WHERE status = 'migrated_in'
),
mo AS (
  SELECT rateation_id AS source_id, debt_id, target_rateation_id AS target_id
  FROM public.rateation_debts
  WHERE status = 'migrated_out'
)
-- migrated_in without corresponding migrated_out
SELECT
  mi.debt_id,
  'orphaned_migrated_in'::text AS issue_type,
  jsonb_build_object(
    'rateation_id', mi.target_id,
    'expected_source_id', mi.source_id
  ) AS details
FROM mi
LEFT JOIN mo ON mo.debt_id = mi.debt_id
            AND mo.source_id = mi.source_id
            AND mo.target_id = mi.target_id
WHERE mo.debt_id IS NULL

UNION ALL
-- migrated_out without corresponding migrated_in
SELECT
  mo.debt_id,
  'orphaned_migrated_out'::text AS issue_type,
  jsonb_build_object(
    'rateation_id', mo.source_id,
    'expected_target_id', mo.target_id
  ) AS details
FROM mo
LEFT JOIN mi ON mi.debt_id = mo.debt_id
            AND mi.source_id = mo.source_id
            AND mi.target_id = mo.target_id
WHERE mi.debt_id IS NULL
$$;

-- 2. Update fn_realign_rateation_totals to use UUID parameter
CREATE OR REPLACE FUNCTION public.fn_realign_rateation_totals(p_rateation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_before jsonb;
  v_after jsonb;
BEGIN
  -- Check ownership
  IF NOT EXISTS(SELECT 1 FROM rateations WHERE id = p_rateation_id::bigint AND owner_uid = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Capture state before
  SELECT jsonb_build_object(
    'paid_amount_cents', paid_amount_cents,
    'residual_amount_cents', residual_amount_cents,
    'overdue_amount_cents', overdue_amount_cents
  ) INTO v_before
  FROM rateations WHERE id = p_rateation_id::bigint;

  -- Force recalculation
  PERFORM recompute_rateation_caches(p_rateation_id::bigint);

  -- Capture state after
  SELECT jsonb_build_object(
    'paid_amount_cents', paid_amount_cents,
    'residual_amount_cents', residual_amount_cents,
    'overdue_amount_cents', overdue_amount_cents
  ) INTO v_after
  FROM rateations WHERE id = p_rateation_id::bigint;

  RETURN jsonb_build_object(
    'rateation_id', p_rateation_id,
    'before', v_before,
    'after', v_after,
    'changed', v_before != v_after
  );
END;
$$;

-- 3. Add security constraints and indices
-- Prevent a debt from being 'active' in multiple rateations simultaneously
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_debt
ON public.rateation_debts(debt_id)
WHERE status = 'active';

-- Performance indices
CREATE INDEX IF NOT EXISTS idx_rd_rateation_status ON public.rateation_debts(rateation_id, status);
CREATE INDEX IF NOT EXISTS idx_rd_debt ON public.rateation_debts(debt_id);
CREATE INDEX IF NOT EXISTS idx_rd_target ON public.rateation_debts(target_rateation_id);
CREATE INDEX IF NOT EXISTS idx_installments_rateation_due ON public.installments(rateation_id, due_date, is_paid);

-- 4. Harden migrate_debts_to_rq with additional security guards
CREATE OR REPLACE FUNCTION public.migrate_debts_to_rq(p_source_rateation_id bigint, p_debt_ids uuid[], p_target_rateation_id bigint, p_note text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Prevent self-migration
  IF p_source_rateation_id = p_target_rateation_id THEN
    RAISE EXCEPTION 'Cannot migrate to the same rateation';
  END IF;

  -- Explicit ownership check (SECURITY DEFINER bypasses RLS)
  IF NOT EXISTS(
    SELECT 1 FROM public.rateations 
    WHERE id = p_source_rateation_id AND owner_uid = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied: source';
  END IF;
  
  IF NOT EXISTS(
    SELECT 1 FROM public.rateations 
    WHERE id = p_target_rateation_id AND owner_uid = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied: target';
  END IF;

  -- Check for active debts to migrate
  PERFORM 1 FROM public.rateation_debts
  WHERE rateation_id = p_source_rateation_id
    AND debt_id = ANY(p_debt_ids)
    AND status = 'active';
    
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active debts found';
  END IF;

  -- Lock tables to prevent race conditions
  LOCK TABLE public.rateation_debts IN ROW SHARE MODE;

  -- Atomic operation: Update source rateation debts to 'migrated_out'
  UPDATE public.rateation_debts
  SET status = 'migrated_out',
      target_rateation_id = p_target_rateation_id,
      migrated_at = CURRENT_DATE,
      note = COALESCE(p_note, note)
  WHERE rateation_id = p_source_rateation_id
    AND debt_id = ANY(p_debt_ids)
    AND status = 'active';

  -- Verify we updated some records
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active debts found to migrate';
  END IF;

  -- Atomic operation: Create/update target rateation debt links
  INSERT INTO public.rateation_debts(rateation_id, debt_id, status, target_rateation_id, migrated_at, note)
  SELECT p_target_rateation_id, d_id, 'migrated_in', p_source_rateation_id, CURRENT_DATE, p_note
  FROM unnest(p_debt_ids) AS d_id
  ON CONFLICT (rateation_id, debt_id) DO UPDATE
  SET status = EXCLUDED.status,
      target_rateation_id = EXCLUDED.target_rateation_id,
      migrated_at = EXCLUDED.migrated_at,
      note = COALESCE(EXCLUDED.note, public.rateation_debts.note);
END;
$$;

-- 5. Harden rollback_debt_migration with additional security guards
CREATE OR REPLACE FUNCTION public.rollback_debt_migration(p_source_rateation_id bigint, p_debt_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Explicit ownership check (SECURITY DEFINER bypasses RLS)
  IF NOT EXISTS(
    SELECT 1 FROM public.rateations 
    WHERE id = p_source_rateation_id AND owner_uid = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied: source';
  END IF;

  -- Check for migrated debts to rollback
  PERFORM 1 FROM public.rateation_debts
  WHERE rateation_id = p_source_rateation_id
    AND debt_id = ANY(p_debt_ids)
    AND status = 'migrated_out';
    
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No migrated debts found';
  END IF;

  -- Rollback: Set migrated_out debts back to active
  UPDATE public.rateation_debts
  SET status = 'active',
      target_rateation_id = NULL,
      migrated_at = NULL,
      note = NULL
  WHERE rateation_id = p_source_rateation_id
    AND debt_id = ANY(p_debt_ids)
    AND status = 'migrated_out';

  -- Remove corresponding migrated_in records
  DELETE FROM public.rateation_debts
  WHERE debt_id = ANY(p_debt_ids)
    AND status = 'migrated_in'
    AND target_rateation_id = p_source_rateation_id;
END;
$$;

-- 6. Configure proper RPC permissions for security
REVOKE ALL ON FUNCTION public.migrate_debts_to_rq(bigint, uuid[], bigint, text) FROM public;
REVOKE ALL ON FUNCTION public.rollback_debt_migration(bigint, uuid[]) FROM public;
REVOKE ALL ON FUNCTION public.fn_detect_orphaned_migrations() FROM public;
REVOKE ALL ON FUNCTION public.fn_realign_rateation_totals(uuid) FROM public;

GRANT EXECUTE ON FUNCTION public.migrate_debts_to_rq(bigint, uuid[], bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rollback_debt_migration(bigint, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_detect_orphaned_migrations() TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_realign_rateation_totals(uuid) TO authenticated;