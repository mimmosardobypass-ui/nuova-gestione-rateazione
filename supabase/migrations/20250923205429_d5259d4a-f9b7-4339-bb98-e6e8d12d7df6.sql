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

-- 3. Drop views in CASCADE to handle dependencies
DROP VIEW IF EXISTS v_kpi_rateations_effective CASCADE;
DROP VIEW IF EXISTS v_rateations_with_kpis CASCADE;

-- 4. Recreate v_rateations_with_kpis with overdue_effective_cents
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

-- 5. Recreate v_kpi_rateations_effective 
CREATE VIEW v_kpi_rateations_effective AS
SELECT 
  COALESCE(SUM(residual_effective_cents), 0) AS effective_residual_amount_cents
FROM v_rateations_with_kpis
WHERE owner_uid = auth.uid();

-- 6. Create KPI view for effective overdue amounts
CREATE VIEW v_kpi_rateations_overdue_effective AS
SELECT 
  COALESCE(SUM(overdue_effective_cents), 0) AS effective_overdue_amount_cents
FROM v_rateations_with_kpis
WHERE owner_uid = auth.uid();