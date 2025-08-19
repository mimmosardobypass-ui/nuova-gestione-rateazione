-- Function to apply rateation edits with atomic transaction
CREATE OR REPLACE FUNCTION public.apply_rateation_edits(
  p_rateation_id bigint,
  p_rows jsonb     -- [{seq, due_date, amount}]
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r jsonb;
  v_seq int;
  v_due date;
  v_amount numeric;
BEGIN
  -- Lock to prevent race conditions
  PERFORM 1
  FROM installments
  WHERE rateation_id = p_rateation_id
  FOR UPDATE;

  -- Upsert rows (only unpaid ones)
  FOR r IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_seq    := (r->>'seq')::int;
    v_due    := (r->>'due_date')::date;
    v_amount := COALESCE((r->>'amount')::numeric, 0);

    -- Update if exists and is unpaid
    UPDATE installments
    SET due_date = v_due,
        amount   = v_amount
    WHERE rateation_id = p_rateation_id
      AND seq = v_seq
      AND paid_at IS NULL;

    -- Insert if not found (always unpaid)
    IF NOT FOUND THEN
      INSERT INTO installments(rateation_id, seq, due_date, amount, owner_uid)
      VALUES (p_rateation_id, v_seq, v_due, v_amount, auth.uid())
      ON CONFLICT (rateation_id, seq) DO NOTHING;
    END IF;
  END LOOP;

  -- Delete unpaid installments not in the new list
  DELETE FROM installments i
  WHERE i.rateation_id = p_rateation_id
    AND i.paid_at IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_rows) r
      WHERE (r->>'seq')::int = i.seq
    );

  -- Recompute aggregated totals
  PERFORM public.recompute_rateation_caches(p_rateation_id);
END;
$$;

-- Function to recompute rateation aggregate fields
CREATE OR REPLACE FUNCTION public.recompute_rateation_caches(
  p_rateation_id bigint
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE rateations SET
    total_amount = COALESCE((
      SELECT SUM(amount)
      FROM installments i
      WHERE i.rateation_id = rateations.id
    ), 0)
  WHERE id = p_rateation_id;

  -- Trigger status recalculation
  PERFORM fn_recalc_rateation_status(p_rateation_id);
END;
$$;