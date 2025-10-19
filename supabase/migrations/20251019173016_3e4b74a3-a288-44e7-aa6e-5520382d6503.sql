-- Fix fn_recalc_rateation_status to preserve 'decaduta' status
CREATE OR REPLACE FUNCTION public.fn_recalc_rateation_status(p_rateation_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total int;
  v_paid int;
  v_late int;
  v_current_status text;
BEGIN
  -- Get current status
  SELECT status INTO v_current_status
  FROM rateations
  WHERE id = p_rateation_id;
  
  -- CRITICAL: If already 'decaduta' or 'DECADUTA', don't recalculate
  IF UPPER(COALESCE(v_current_status, '')) = 'DECADUTA' THEN
    RETURN;
  END IF;
  
  -- Count installments
  SELECT count(*),
         count(*) FILTER (WHERE is_paid),
         count(*) FILTER (WHERE NOT is_paid AND due_date < current_date)
  INTO v_total, v_paid, v_late
  FROM installments
  WHERE rateation_id = p_rateation_id;

  -- Update status only if not decaduta
  UPDATE rateations
  SET status = CASE
    WHEN v_total > 0 AND v_paid = v_total THEN 'completata'
    WHEN v_late > 0 THEN 'in_ritardo'
    ELSE 'attiva'
  END
  WHERE id = p_rateation_id
    AND UPPER(COALESCE(status, '')) != 'DECADUTA';
END;
$$;

COMMENT ON FUNCTION fn_recalc_rateation_status IS 'Recalculates rateation status but preserves manually confirmed decaduta status';

-- Drop and recreate v_dashboard_decaduto with case-insensitive check
DROP VIEW IF EXISTS public.v_dashboard_decaduto CASCADE;

CREATE VIEW public.v_dashboard_decaduto AS
SELECT
  COALESCE(SUM(r.residual_at_decadence_cents), 0) as gross_decayed_cents,
  COALESCE(SUM(r.transferred_amount * 100), 0) as transferred_cents,
  (COALESCE(SUM(r.residual_at_decadence_cents), 0) - COALESCE(SUM(r.transferred_amount * 100), 0)) as net_to_transfer_cents
FROM rateations r
WHERE r.owner_uid = auth.uid()
  AND r.is_f24 = true 
  AND UPPER(COALESCE(r.status, '')) = 'DECADUTA';

COMMENT ON VIEW v_dashboard_decaduto IS 'Aggregated decayed F24 balances per user (case-insensitive status check)';