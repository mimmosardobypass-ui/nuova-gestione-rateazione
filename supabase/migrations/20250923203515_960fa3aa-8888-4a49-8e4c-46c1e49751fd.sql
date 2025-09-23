-- Create health check function for KPI coherence verification
CREATE OR REPLACE FUNCTION public.fn_verify_kpi_coherence()
RETURNS TABLE(
  status text,
  storico_cents bigint,
  effettivo_cents bigint,
  interrotte_snapshot_cents bigint,
  difference_cents bigint,
  expected_difference_cents bigint,
  is_coherent boolean,
  details jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_storico_cents bigint;
  v_effettivo_cents bigint;
  v_interrotte_snapshot_cents bigint;
  v_difference_cents bigint;
  v_is_coherent boolean;
BEGIN
  -- Get historical total (from all rateations)
  SELECT COALESCE(SUM(residual_amount_cents), 0)
  INTO v_storico_cents
  FROM v_rateations_with_kpis
  WHERE owner_uid = auth.uid();

  -- Get effective total (excluding interrupted)
  SELECT COALESCE(effective_residual_amount_cents, 0)::bigint
  INTO v_effettivo_cents
  FROM v_kpi_rateations_effective;

  -- Get interrupted snapshots total
  SELECT COALESCE(SUM(residual_at_interruption_cents), 0)
  INTO v_interrotte_snapshot_cents
  FROM rateations
  WHERE status = 'INTERROTTA' AND owner_uid = auth.uid();

  -- Calculate actual difference
  v_difference_cents := v_storico_cents - v_effettivo_cents;

  -- Check coherence (difference should match interrupted snapshots)
  v_is_coherent := ABS(v_difference_cents - v_interrotte_snapshot_cents) <= 100; -- Allow 1 euro tolerance

  RETURN QUERY SELECT
    CASE WHEN v_is_coherent THEN 'OK' ELSE 'WARNING' END::text,
    v_storico_cents,
    v_effettivo_cents,
    v_interrotte_snapshot_cents,
    v_difference_cents,
    v_interrotte_snapshot_cents as expected_difference_cents,
    v_is_coherent,
    jsonb_build_object(
      'message', CASE 
        WHEN v_is_coherent THEN 'KPI coherence verified: historical vs effective difference matches interrupted snapshots'
        ELSE 'WARNING: KPI incoherence detected - difference does not match interrupted snapshots'
      END,
      'storico_euro', (v_storico_cents::numeric / 100),
      'effettivo_euro', (v_effettivo_cents::numeric / 100),
      'interrotte_euro', (v_interrotte_snapshot_cents::numeric / 100),
      'difference_euro', (v_difference_cents::numeric / 100)
    ) as details;
END;
$function$;