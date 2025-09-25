-- Step 2: Create robust pagopa_quota_info that handles corrupted data
CREATE OR REPLACE FUNCTION public.pagopa_quota_info(p_pagopa_id bigint)
RETURNS TABLE (
  residual_cents bigint,
  allocated_cents bigint,
  allocatable_cents bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stored_residual bigint;
  v_calculated_residual bigint;
  v_final_residual bigint;
  v_allocated bigint;
BEGIN
  -- Check ownership
  IF NOT EXISTS(SELECT 1 FROM rateations WHERE id = p_pagopa_id AND owner_uid = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Get stored residual
  SELECT COALESCE(r.residual_amount_cents, 0)
  INTO v_stored_residual  
  FROM rateations r
  WHERE r.id = p_pagopa_id;

  -- Calculate actual residual from installments
  SELECT COALESCE(SUM(CASE WHEN i.is_paid = false THEN COALESCE(i.amount_cents, (i.amount * 100)::bigint) ELSE 0 END), 0)
  INTO v_calculated_residual
  FROM installments i
  WHERE i.rateation_id = p_pagopa_id;

  -- Use calculated if stored is 0 or significantly different (corruption detection)
  v_final_residual := CASE 
    WHEN v_stored_residual = 0 AND v_calculated_residual > 0 THEN v_calculated_residual
    WHEN v_calculated_residual > 0 AND ABS(v_stored_residual - v_calculated_residual) > (v_calculated_residual * 0.01) THEN v_calculated_residual -- >1% difference
    ELSE v_stored_residual
  END;

  -- Get allocated amount from active links only
  SELECT COALESCE(SUM(l.allocated_residual_cents), 0)
  INTO v_allocated
  FROM riam_quater_links l
  WHERE l.pagopa_id = p_pagopa_id;

  RETURN QUERY SELECT
    v_final_residual,
    v_allocated,
    GREATEST(v_final_residual - v_allocated, 0)::bigint;
END;
$$;