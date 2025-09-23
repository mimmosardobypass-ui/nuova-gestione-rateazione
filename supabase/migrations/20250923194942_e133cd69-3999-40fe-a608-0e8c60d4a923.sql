-- FASE 1: Create v_kpi_rateations_effective for homepage KPI
-- This view calculates only the effective residual (excluding interrupted PagoPA)
CREATE OR REPLACE VIEW v_kpi_rateations_effective AS
SELECT 
  SUM(
    CASE
      WHEN r.status = 'INTERROTTA' THEN 0
      WHEN r.interrupted_by_rateation_id IS NOT NULL THEN 0  
      WHEN r.status = 'decaduta' THEN 0
      ELSE COALESCE(r.residual_amount_cents, 0)
    END
  ) AS effective_residual_amount_cents
FROM rateations r
WHERE r.owner_uid = auth.uid();

-- FASE 2: Add residual_effective_cents to existing view
-- First, let me get the current view definition and modify it
DROP VIEW IF EXISTS v_rateations_with_kpis;

CREATE VIEW v_rateations_with_kpis AS
WITH rateation_base AS (
  SELECT 
    r.id,
    r.owner_uid,
    r.created_at,
    r.updated_at,
    r.number,
    r.taxpayer_name,
    r.total_amount,
    r.status,
    r.type_id,
    r.is_f24,
    r.interrupted_by_rateation_id,
    rt.name as tipo,
    (rt.name = 'PagoPA') as is_pagopa,
    
    -- Amounts in cents
    (r.total_amount * 100)::numeric as total_amount_cents,
    COALESCE(r.paid_amount_cents, 0) as paid_amount_cents,
    COALESCE(r.residual_amount_cents, 0) as residual_amount_cents,
    COALESCE(r.overdue_amount_cents, 0) as overdue_amount_cents,
    
    -- NEW: Effective residual (what counts for homepage totals)
    CASE
      WHEN r.status = 'INTERROTTA' THEN 0
      WHEN r.interrupted_by_rateation_id IS NOT NULL THEN 0
      WHEN r.status = 'decaduta' THEN 0
      ELSE COALESCE(r.residual_amount_cents, 0)
    END AS residual_effective_cents,
    
    -- Installment stats
    COALESCE(inst.rate_totali, 0) as rate_totali,
    COALESCE(inst.rate_pagate, 0) as rate_pagate,
    COALESCE(inst.rate_in_ritardo, 0) as rate_in_ritardo,
    
    -- PagoPA specific amounts for today
    CASE WHEN rt.name = 'PagoPA' THEN
      COALESCE((
        SELECT SUM(i.amount_cents)
        FROM installments i 
        WHERE i.rateation_id = r.id 
        AND i.is_paid = false 
        AND i.due_date = CURRENT_DATE
      ), 0)
    ELSE 0 END as due_today_cents,
    
    CASE WHEN rt.name = 'PagoPA' THEN
      COALESCE((
        SELECT COUNT(*)::bigint
        FROM installments i 
        WHERE i.rateation_id = r.id 
        AND i.is_paid = false 
        AND i.due_date = CURRENT_DATE
      ), 0)
    ELSE 0 END as unpaid_due_today,
    
    -- PagoPA KPI fields
    COALESCE(pkpi.unpaid_overdue_today, 0) as unpaid_overdue_today,
    COALESCE(pkpi.max_skips_effective, 0) as max_skips_effective, 
    COALESCE(pkpi.skip_remaining, 0) as skip_remaining,
    
    -- Risk calculation for PagoPA
    CASE WHEN rt.name = 'PagoPA' THEN
      COALESCE(pkpi.skip_remaining, 0) <= 1
    ELSE false END as at_risk_decadence,
    
    -- Migration fields
    COALESCE(debt_stats.debts_total, 0) as debts_total,
    COALESCE(debt_stats.debts_migrated, 0) as debts_migrated,
    debt_stats.migrated_debt_numbers,
    debt_stats.remaining_debt_numbers,
    debt_stats.rq_target_ids,
    debt_stats.rq_migration_status,
    
    -- Exclusion flag for stats
    CASE 
      WHEN r.status IN ('decaduta', 'estinta') THEN true
      WHEN r.status = 'INTERROTTA' AND r.interrupted_by_rateation_id IS NOT NULL THEN true
      ELSE false
    END as excluded_from_stats
    
  FROM rateations r
  LEFT JOIN rateation_types rt ON r.type_id = rt.id
  LEFT JOIN (
    SELECT 
      rateation_id,
      COUNT(*) as rate_totali,
      COUNT(*) FILTER (WHERE is_paid = true) as rate_pagate,
      COUNT(*) FILTER (WHERE is_paid = false AND due_date < CURRENT_DATE) as rate_in_ritardo
    FROM installments
    GROUP BY rateation_id
  ) inst ON r.id = inst.rateation_id
  LEFT JOIN v_pagopa_today_kpis pkpi ON r.id = pkpi.rateation_id
  LEFT JOIN (
    SELECT 
      rd.rateation_id,
      COUNT(rd.debt_id) as debts_total,
      COUNT(rd.debt_id) FILTER (WHERE rd.status = 'migrated_out') as debts_migrated,
      ARRAY_AGG(d.number) FILTER (WHERE rd.status = 'migrated_out') as migrated_debt_numbers,
      ARRAY_AGG(d.number) FILTER (WHERE rd.status = 'active') as remaining_debt_numbers,
      ARRAY_AGG(DISTINCT rd.target_rateation_id) FILTER (WHERE rd.status = 'migrated_out') as rq_target_ids,
      CASE
        WHEN COUNT(rd.debt_id) FILTER (WHERE rd.status = 'active') = 0 THEN 'completed'
        WHEN COUNT(rd.debt_id) FILTER (WHERE rd.status = 'migrated_out') > 0 THEN 'partial'
        ELSE 'none'
      END as rq_migration_status
    FROM rateation_debts rd
    LEFT JOIN debts d ON rd.debt_id = d.id
    GROUP BY rd.rateation_id
  ) debt_stats ON r.id = debt_stats.rateation_id
)
SELECT * FROM rateation_base;