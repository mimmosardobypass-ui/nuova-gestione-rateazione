-- 1. Add snapshot field for overdue at interruption
ALTER TABLE rateations 
ADD COLUMN IF NOT EXISTS overdue_at_interruption_cents BIGINT DEFAULT 0;

-- 2. Update the existing interruption capture function to also capture overdue
CREATE OR REPLACE FUNCTION public.fn_capture_interruption_snapshot()
RETURNS trigger AS $$
BEGIN
  -- Only trigger when transitioning TO 'INTERROTTA' status
  IF TG_OP = 'UPDATE' AND 
     COALESCE(OLD.status, 'attiva') <> 'INTERROTTA' AND 
     NEW.status = 'INTERROTTA' THEN
    
    -- Capture current residual amount from unpaid installments
    SELECT COALESCE(SUM(i.amount_cents), 0)
    INTO NEW.residual_at_interruption_cents
    FROM installments i
    WHERE i.rateation_id = NEW.id AND i.is_paid = false;
    
    -- Capture current overdue amount from unpaid installments past due
    SELECT COALESCE(SUM(i.amount_cents), 0)
    INTO NEW.overdue_at_interruption_cents
    FROM installments i
    WHERE i.rateation_id = NEW.id 
      AND i.is_paid = false 
      AND i.due_date < CURRENT_DATE;
    
    -- Set interruption timestamp
    NEW.interrupted_at := COALESCE(NEW.interrupted_at, CURRENT_DATE);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- 3. Drop and recreate views with CASCADE to handle dependencies
DROP VIEW IF EXISTS v_rateations_with_kpis CASCADE;

CREATE VIEW v_rateations_with_kpis AS
SELECT 
  r.id,
  r.number,
  r.taxpayer_name,
  r.status,
  r.is_f24,
  r.type_id,
  r.created_at,
  r.updated_at,
  r.total_amount,
  r.interrupted_at,
  r.interrupted_by_rateation_id,
  r.residual_at_interruption_cents,
  r.overdue_at_interruption_cents,
  r.owner_uid,
  
  -- Get type name
  rt.name as tipo,
  
  -- Amounts in cents (calculated from installments)
  (r.total_amount * 100)::bigint as total_amount_cents,
  COALESCE(r.paid_amount_cents, 0) as paid_amount_cents,
  COALESCE(r.residual_amount_cents, 0) as residual_amount_cents,
  COALESCE(r.overdue_amount_cents, 0) as overdue_amount_cents,
  
  -- Effective amounts (0 for interrupted PagoPA)
  CASE WHEN r.status = 'INTERROTTA' 
       THEN 0 
       ELSE COALESCE(r.residual_amount_cents, 0) 
  END as residual_effective_cents,
  
  CASE WHEN r.status = 'INTERROTTA' 
       THEN 0 
       ELSE COALESCE(r.overdue_amount_cents, 0) 
  END as overdue_effective_cents,
  
  -- Installment counts
  COALESCE(inst_stats.rate_totali, 0) as rate_totali,
  COALESCE(inst_stats.rate_pagate, 0) as rate_pagate,
  COALESCE(inst_stats.rate_in_ritardo, 0) as rate_in_ritardo,
  
  -- Today's metrics for PagoPA (using correct column names)
  COALESCE(today_stats.unpaid_count, 0) as unpaid_due_today,
  COALESCE(today_stats.unpaid_overdue_today, 0) as unpaid_overdue_today,
  COALESCE((
    SELECT COALESCE(SUM(i.amount_cents), 0)
    FROM installments i
    WHERE i.rateation_id = r.id 
      AND i.is_paid = false 
      AND i.due_date <= CURRENT_DATE
  ), 0) as due_today_cents,
  COALESCE(kpi_stats.max_skips_effective, 0) as max_skips_effective,
  COALESCE(kpi_stats.skip_remaining, 0) as skip_remaining,
  COALESCE(today_stats.at_risk_decadence, false) as at_risk_decadence,
  
  -- Determine if PagoPA
  CASE WHEN UPPER(COALESCE(rt.name, '')) = 'PAGOPA' THEN true ELSE false END as is_pagopa,
  
  -- Migration status and debt info (if applicable)
  debt_info.rq_migration_status,
  debt_info.debts_total,
  debt_info.debts_migrated,
  debt_info.remaining_debt_numbers,
  debt_info.migrated_debt_numbers,
  debt_info.rq_target_ids,
  
  -- Exclusion logic for stats
  CASE WHEN r.status = 'INTERROTTA' AND UPPER(COALESCE(rt.name, '')) = 'PAGOPA' 
       THEN true 
       ELSE false 
  END as excluded_from_stats

FROM rateations r
LEFT JOIN rateation_types rt ON rt.id = r.type_id
LEFT JOIN (
  SELECT 
    rateation_id,
    COUNT(*) as rate_totali,
    COUNT(*) FILTER (WHERE is_paid = true) as rate_pagate,
    COUNT(*) FILTER (WHERE is_paid = false AND due_date < CURRENT_DATE) as rate_in_ritardo
  FROM installments
  GROUP BY rateation_id
) inst_stats ON inst_stats.rateation_id = r.id
LEFT JOIN v_pagopa_unpaid_today today_stats ON today_stats.rateation_id = r.id
LEFT JOIN v_pagopa_today_kpis kpi_stats ON kpi_stats.rateation_id = r.id
LEFT JOIN (
  SELECT 
    rd.rateation_id,
    CASE 
      WHEN COUNT(*) FILTER (WHERE rd.status = 'migrated_out') > 0 THEN 'partial_migrated'
      WHEN COUNT(*) FILTER (WHERE rd.status = 'active') = 0 AND COUNT(*) > 0 THEN 'fully_migrated'
      ELSE 'not_migrated'
    END as rq_migration_status,
    COUNT(*) as debts_total,
    COUNT(*) FILTER (WHERE rd.status = 'migrated_out') as debts_migrated,
    array_agg(d.number ORDER BY d.number) FILTER (WHERE rd.status = 'active') as remaining_debt_numbers,
    array_agg(d.number ORDER BY d.number) FILTER (WHERE rd.status = 'migrated_out') as migrated_debt_numbers,
    array_agg(DISTINCT rd.target_rateation_id) FILTER (WHERE rd.status = 'migrated_out') as rq_target_ids
  FROM rateation_debts rd
  LEFT JOIN debts d ON d.id = rd.debt_id
  GROUP BY rd.rateation_id
) debt_info ON debt_info.rateation_id = r.id;

-- 4. Recreate the KPI views
CREATE OR REPLACE VIEW v_kpi_rateations_effective AS
SELECT 
  COALESCE(SUM(residual_effective_cents), 0) AS effective_residual_amount_cents
FROM v_rateations_with_kpis
WHERE owner_uid = auth.uid();

CREATE OR REPLACE VIEW v_kpi_rateations_overdue_effective AS
SELECT 
  COALESCE(SUM(overdue_effective_cents), 0) AS effective_overdue_amount_cents
FROM v_rateations_with_kpis
WHERE owner_uid = auth.uid();

-- 5. Drop and recreate the KPI coherence function with updated signature
DROP FUNCTION IF EXISTS public.fn_verify_kpi_coherence();

CREATE FUNCTION public.fn_verify_kpi_coherence()
RETURNS TABLE(
  status text, 
  residual_storico_cents bigint, 
  residual_effettivo_cents bigint, 
  residual_interrotte_snapshot_cents bigint,
  overdue_storico_cents bigint,
  overdue_effettivo_cents bigint, 
  overdue_interrotte_snapshot_cents bigint,
  residual_difference_cents bigint, 
  overdue_difference_cents bigint,
  residual_expected_difference_cents bigint,
  overdue_expected_difference_cents bigint,
  is_residual_coherent boolean,
  is_overdue_coherent boolean,
  is_coherent boolean, 
  details jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_residual_storico_cents bigint;
  v_residual_effettivo_cents bigint;
  v_residual_interrotte_snapshot_cents bigint;
  v_overdue_storico_cents bigint;
  v_overdue_effettivo_cents bigint;
  v_overdue_interrotte_snapshot_cents bigint;
  v_residual_difference_cents bigint;
  v_overdue_difference_cents bigint;
  v_is_residual_coherent boolean;
  v_is_overdue_coherent boolean;
  v_is_coherent boolean;
BEGIN
  -- Get residual historical total (from all rateations)
  SELECT COALESCE(SUM(residual_amount_cents), 0)
  INTO v_residual_storico_cents
  FROM v_rateations_with_kpis
  WHERE owner_uid = auth.uid();

  -- Get residual effective total (excluding interrupted)
  SELECT COALESCE(effective_residual_amount_cents, 0)::bigint
  INTO v_residual_effettivo_cents
  FROM v_kpi_rateations_effective;

  -- Get residual interrupted snapshots total
  SELECT COALESCE(SUM(residual_at_interruption_cents), 0)
  INTO v_residual_interrotte_snapshot_cents
  FROM rateations
  WHERE status = 'INTERROTTA' AND owner_uid = auth.uid();

  -- Get overdue historical total (from all rateations)
  SELECT COALESCE(SUM(overdue_amount_cents), 0)
  INTO v_overdue_storico_cents
  FROM v_rateations_with_kpis
  WHERE owner_uid = auth.uid();

  -- Get overdue effective total (excluding interrupted)
  SELECT COALESCE(effective_overdue_amount_cents, 0)::bigint
  INTO v_overdue_effettivo_cents
  FROM v_kpi_rateations_overdue_effective;

  -- Get overdue interrupted snapshots total
  SELECT COALESCE(SUM(overdue_at_interruption_cents), 0)
  INTO v_overdue_interrotte_snapshot_cents
  FROM rateations
  WHERE status = 'INTERROTTA' AND owner_uid = auth.uid();

  -- Calculate actual differences
  v_residual_difference_cents := v_residual_storico_cents - v_residual_effettivo_cents;
  v_overdue_difference_cents := v_overdue_storico_cents - v_overdue_effettivo_cents;

  -- Check coherence (differences should match interrupted snapshots)
  v_is_residual_coherent := ABS(v_residual_difference_cents - v_residual_interrotte_snapshot_cents) <= 100; -- Allow 1 euro tolerance
  v_is_overdue_coherent := ABS(v_overdue_difference_cents - v_overdue_interrotte_snapshot_cents) <= 100; -- Allow 1 euro tolerance
  v_is_coherent := v_is_residual_coherent AND v_is_overdue_coherent;

  RETURN QUERY SELECT
    CASE WHEN v_is_coherent THEN 'OK' ELSE 'WARNING' END::text,
    v_residual_storico_cents,
    v_residual_effettivo_cents,
    v_residual_interrotte_snapshot_cents,
    v_overdue_storico_cents,
    v_overdue_effettivo_cents,
    v_overdue_interrotte_snapshot_cents,
    v_residual_difference_cents,
    v_overdue_difference_cents,
    v_residual_interrotte_snapshot_cents as residual_expected_difference_cents,
    v_overdue_interrotte_snapshot_cents as overdue_expected_difference_cents,
    v_is_residual_coherent,
    v_is_overdue_coherent,
    v_is_coherent,
    jsonb_build_object(
      'message', CASE 
        WHEN v_is_coherent THEN 'KPI coherence verified: both residual and overdue differences match interrupted snapshots'
        ELSE 'WARNING: KPI incoherence detected'
      END,
      'residual', jsonb_build_object(
        'storico_euro', (v_residual_storico_cents::numeric / 100),
        'effettivo_euro', (v_residual_effettivo_cents::numeric / 100),
        'interrotte_euro', (v_residual_interrotte_snapshot_cents::numeric / 100),
        'difference_euro', (v_residual_difference_cents::numeric / 100),
        'coherent', v_is_residual_coherent
      ),
      'overdue', jsonb_build_object(
        'storico_euro', (v_overdue_storico_cents::numeric / 100),
        'effettivo_euro', (v_overdue_effettivo_cents::numeric / 100),
        'interrotte_euro', (v_overdue_interrotte_snapshot_cents::numeric / 100),
        'difference_euro', (v_overdue_difference_cents::numeric / 100),
        'coherent', v_is_overdue_coherent
      )
    ) as details;
END;
$function$;