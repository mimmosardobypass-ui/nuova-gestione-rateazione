-- Fix v_rateations_with_kpis - eliminare duplicazione colonne

DROP VIEW IF EXISTS public.v_rateations_with_kpis;

CREATE OR REPLACE VIEW public.v_rateations_with_kpis AS
WITH debts_link AS (
  SELECT
    rd.rateation_id,
    COUNT(*) AS debts_total,
    COUNT(*) FILTER (WHERE rd.status = 'migrated_out') AS debts_migrated,
    array_agg(d.number ORDER BY d.number) 
      FILTER (WHERE rd.status = 'migrated_out') AS migrated_debt_numbers,
    array_agg(d.number ORDER BY d.number) 
      FILTER (WHERE rd.status = 'active') AS remaining_debt_numbers,
    array_remove(array_agg(DISTINCT rd.target_rateation_id), NULL) AS rq_target_ids
  FROM public.rateation_debts rd
  LEFT JOIN public.debts d ON d.id = rd.debt_id
  GROUP BY rd.rateation_id
),
agg AS (
  SELECT
    r.id,
    r.owner_uid,
    r.number,
    r.taxpayer_name,
    r.type_id,
    rt.name AS tipo,
    r.total_amount,
    r.created_at,
    r.updated_at,
    r.status,
    r.is_f24,
    -- KPI calculations
    COALESCE(r.total_amount, 0) AS total_amount_cents,
    COALESCE(r.paid_amount_cents, 0) AS paid_amount_cents,
    COALESCE(r.residual_amount_cents, 0) AS residual_amount_cents,
    COALESCE(r.overdue_amount_cents, 0) AS overdue_amount_cents,
    
    -- Rate calculations
    COUNT(i.*) AS rate_totali,
    COUNT(i.*) FILTER (WHERE i.is_paid = true) AS rate_pagate,
    COUNT(i.*) FILTER (WHERE i.is_paid = false) AS rate_non_pagate,
    COUNT(i.*) FILTER (WHERE i.is_paid = false AND i.due_date < CURRENT_DATE) AS rate_in_ritardo,
    
    -- PagoPA KPI calculations (raw values)
    CASE WHEN UPPER(rt.name) = 'PAGOPA' THEN
      COUNT(i.*) FILTER (WHERE i.is_paid = false AND i.due_date < CURRENT_DATE)
    ELSE 0 END AS raw_unpaid_overdue_today,
    
    CASE WHEN UPPER(rt.name) = 'PAGOPA' THEN
      COUNT(i.*) FILTER (WHERE i.is_paid = false AND i.due_date = CURRENT_DATE)
    ELSE 0 END AS raw_unpaid_due_today
    
  FROM public.rateations r
  LEFT JOIN public.rateation_types rt ON rt.id = r.type_id
  LEFT JOIN public.installments i ON i.rateation_id = r.id
  GROUP BY r.id, r.owner_uid, r.number, r.taxpayer_name, r.type_id, rt.name, 
           r.total_amount, r.created_at, r.updated_at, r.status, r.is_f24,
           r.paid_amount_cents, r.residual_amount_cents, r.overdue_amount_cents
)
SELECT
  agg.*,
  -- Debt migration fields
  COALESCE(dl.debts_total, 0) AS debts_total,
  COALESCE(dl.debts_migrated, 0) AS debts_migrated,
  dl.migrated_debt_numbers,
  dl.remaining_debt_numbers,
  dl.rq_target_ids,
  
  -- Migration status
  CASE
    WHEN UPPER(agg.tipo) = 'PAGOPA' AND COALESCE(dl.debts_total, 0) > 0 AND dl.debts_migrated = dl.debts_total THEN 'full'
    WHEN UPPER(agg.tipo) = 'PAGOPA' AND COALESCE(dl.debts_migrated, 0) > 0 THEN 'partial'
    ELSE 'none'
  END AS rq_migration_status,
  
  -- Final KPI values (neutralized if migrated)
  CASE WHEN UPPER(agg.tipo) = 'PAGOPA' AND COALESCE(dl.debts_migrated, 0) > 0
    THEN 0 ELSE agg.raw_unpaid_overdue_today END AS unpaid_overdue_today,
    
  CASE WHEN UPPER(agg.tipo) = 'PAGOPA' AND COALESCE(dl.debts_migrated, 0) > 0
    THEN 0 ELSE agg.raw_unpaid_due_today END AS unpaid_due_today,
    
  8 AS max_skips_effective,
  
  CASE WHEN UPPER(agg.tipo) = 'PAGOPA' AND COALESCE(dl.debts_migrated, 0) > 0
    THEN 8 ELSE GREATEST(0, 8 - agg.raw_unpaid_overdue_today) END AS skip_remaining,
    
  CASE WHEN UPPER(agg.tipo) = 'PAGOPA' AND COALESCE(dl.debts_migrated, 0) > 0
    THEN false ELSE (agg.raw_unpaid_overdue_today >= 8) END AS at_risk_decadence,
    
  -- Derived fields for backward compatibility
  UPPER(agg.tipo) = 'PAGOPA' AS is_pagopa,
  (agg.residual_amount_cents / 100.0) AS residuo,
  
  -- Exclude from stats when migrated
  CASE WHEN UPPER(agg.tipo) = 'PAGOPA' AND COALESCE(dl.debts_migrated, 0) > 0
    THEN true ELSE false END AS excluded_from_stats
    
FROM agg
LEFT JOIN debts_link dl ON dl.rateation_id = agg.id;