-- =========== FUNZIONE: MIGRAZIONE ATOMICA ===========
CREATE OR REPLACE FUNCTION public.migrate_debts_to_rq(
  p_source_rateation_id bigint,
  p_debt_ids uuid[],
  p_target_rateation_id bigint,
  p_note text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validation: Check source rateation ownership
  IF NOT EXISTS(
    SELECT 1 FROM public.rateations 
    WHERE id = p_source_rateation_id AND owner_uid = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied to source rateation';
  END IF;

  -- Validation: Check target rateation ownership
  IF NOT EXISTS(
    SELECT 1 FROM public.rateations 
    WHERE id = p_target_rateation_id AND owner_uid = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied to target rateation';
  END IF;

  -- Validation: Prevent self-migration
  IF p_source_rateation_id = p_target_rateation_id THEN
    RAISE EXCEPTION 'Cannot migrate to the same rateation';
  END IF;

  -- Lock tables to prevent race conditions (optional but recommended)
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

-- =========== FUNZIONE: ROLLBACK ATOMICO ===========
CREATE OR REPLACE FUNCTION public.rollback_debt_migration(
  p_source_rateation_id bigint,
  p_debt_ids uuid[]
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check ownership
  IF NOT EXISTS(
    SELECT 1 FROM public.rateations 
    WHERE id = p_source_rateation_id AND owner_uid = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied to source rateation';
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

-- =========== RLS POLICIES ===========
ALTER TABLE public.rateation_debts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rd_select ON public.rateation_debts;
DROP POLICY IF EXISTS rd_modify ON public.rateation_debts;
DROP POLICY IF EXISTS rd_update ON public.rateation_debts;

CREATE POLICY rd_select
ON public.rateation_debts
FOR SELECT
USING (
  EXISTS(
    SELECT 1 FROM public.rateations r
    WHERE r.id = rateation_debts.rateation_id
      AND r.owner_uid = auth.uid()
  )
);

CREATE POLICY rd_modify
ON public.rateation_debts
FOR INSERT
WITH CHECK (
  EXISTS(
    SELECT 1 FROM public.rateations r
    WHERE r.id = rateation_debts.rateation_id
      AND r.owner_uid = auth.uid()
  )
);

CREATE POLICY rd_update
ON public.rateation_debts
FOR UPDATE
USING (
  EXISTS(
    SELECT 1 FROM public.rateations r
    WHERE r.id = rateation_debts.rateation_id
      AND r.owner_uid = auth.uid()
  )
)
WITH CHECK (
  EXISTS(
    SELECT 1 FROM public.rateations r
    WHERE r.id = rateation_debts.rateation_id
      AND r.owner_uid = auth.uid()
  )
);