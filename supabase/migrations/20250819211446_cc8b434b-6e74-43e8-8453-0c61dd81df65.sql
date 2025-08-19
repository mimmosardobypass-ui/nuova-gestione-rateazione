-- Enhanced function with robust parsing for Italian dates and amounts
CREATE OR REPLACE FUNCTION public.apply_rateation_edits(
  p_rateation_id bigint,
  p_rows jsonb     -- [{seq, due_date, amount}]
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r jsonb;
  v_seq int;
  v_due date;
  v_amount numeric;
  v_date_str text;
  v_amount_str text;
BEGIN
  -- Lock to prevent race conditions
  PERFORM 1
  FROM installments
  WHERE rateation_id = p_rateation_id
  FOR UPDATE;

  -- Upsert rows (only unpaid ones)
  FOR r IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_seq := (r->>'seq')::int;

    -- Date: try ISO (YYYY-MM-DD) and fallback to Italian (DD/MM/YYYY)
    v_date_str := NULLIF(r->>'due_date', '');
    v_due := COALESCE(
      CASE 
        WHEN v_date_str ~ '^\d{4}-\d{2}-\d{2}$' THEN v_date_str::date
        WHEN v_date_str ~ '^\d{2}/\d{2}/\d{4}$' THEN 
          TO_DATE(v_date_str, 'DD/MM/YYYY')
        ELSE NULL
      END
    );

    -- Amount: remove thousand separators and replace comma with dot
    v_amount_str := COALESCE(r->>'amount', '0');
    v_amount_str := REPLACE(REPLACE(v_amount_str, '.', ''), ',', '.');
    v_amount := v_amount_str::numeric;

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

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.apply_rateation_edits(bigint, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_rateation_caches(bigint) TO authenticated;