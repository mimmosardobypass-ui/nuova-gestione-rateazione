-- Phase 3: Add RPC Guards (SECURITY)
-- Add comprehensive ownership checks and business validation to RPC functions

-- Update migrate_debts_to_rq with guards
CREATE OR REPLACE FUNCTION public.migrate_debts_to_rq(
  p_source_rateation_id bigint, 
  p_debt_ids uuid[], 
  p_target_rateation_id bigint, 
  p_note text DEFAULT NULL::text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Prevent self-migration
  IF p_source_rateation_id = p_target_rateation_id THEN
    RAISE EXCEPTION 'Cannot migrate to the same rateation';
  END IF;

  -- Ownership check (RLS is bypassed in SECURITY DEFINER: explicit verification required)
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
$function$;

-- Update rollback_debt_migration with guards
CREATE OR REPLACE FUNCTION public.rollback_debt_migration(
  p_source_rateation_id bigint, 
  p_debt_ids uuid[]
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Ownership check (RLS is bypassed in SECURITY DEFINER: explicit verification required)
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
$function$;

-- Phase 4: Database Performance (OPTIMIZATION)
-- Create performance indices for migration operations

-- Index for rateation_debts operations
CREATE INDEX IF NOT EXISTS idx_rd_rateation_status 
ON public.rateation_debts(rateation_id, status);

CREATE INDEX IF NOT EXISTS idx_rd_debt 
ON public.rateation_debts(debt_id);

CREATE INDEX IF NOT EXISTS idx_rd_target 
ON public.rateation_debts(target_rateation_id);

-- Index for installments KPI performance
CREATE INDEX IF NOT EXISTS idx_it_rateation_due 
ON public.installments(rateation_id, due_date, is_paid);

-- Add orphaned migration detection function
CREATE OR REPLACE FUNCTION public.fn_detect_orphaned_migrations()
RETURNS TABLE(debt_id uuid, issue_type text, details jsonb)
LANGUAGE sql
SECURITY DEFINER
AS $function$
  -- Orphaned migrated_in: record migrated_in without corresponding migrated_out
  SELECT 
    rd_in.debt_id,
    'orphaned_migrated_in' as issue_type,
    jsonb_build_object(
      'rateation_id', rd_in.rateation_id,
      'target_rateation_id', rd_in.target_rateation_id,
      'migrated_at', rd_in.migrated_at
    ) as details
  FROM public.rateation_debts rd_in
  WHERE rd_in.status = 'migrated_in'
    AND NOT EXISTS (
      SELECT 1 FROM public.rateation_debts rd_out
      WHERE rd_out.debt_id = rd_in.debt_id
        AND rd_out.status = 'migrated_out'
        AND rd_out.target_rateation_id = rd_in.rateation_id
    )
    AND EXISTS (
      SELECT 1 FROM public.rateations r
      WHERE r.id = rd_in.rateation_id AND r.owner_uid = auth.uid()
    )

  UNION ALL

  -- Orphaned migrated_out: record migrated_out without corresponding migrated_in
  SELECT 
    rd_out.debt_id,
    'orphaned_migrated_out' as issue_type,
    jsonb_build_object(
      'rateation_id', rd_out.rateation_id,
      'target_rateation_id', rd_out.target_rateation_id,
      'migrated_at', rd_out.migrated_at
    ) as details
  FROM public.rateation_debts rd_out
  WHERE rd_out.status = 'migrated_out'
    AND NOT EXISTS (
      SELECT 1 FROM public.rateation_debts rd_in
      WHERE rd_in.debt_id = rd_out.debt_id
        AND rd_in.status = 'migrated_in'
        AND rd_in.target_rateation_id = rd_out.rateation_id
    )
    AND EXISTS (
      SELECT 1 FROM public.rateations r
      WHERE r.id = rd_out.rateation_id AND r.owner_uid = auth.uid()
    );
$function$;