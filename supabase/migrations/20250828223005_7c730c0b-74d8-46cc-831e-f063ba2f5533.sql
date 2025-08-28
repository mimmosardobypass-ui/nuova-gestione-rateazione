-- Recreate v_rateations_with_kpis with realtime cents-based calculations
-- Fixed version with correct column names from pagopa views

DROP VIEW IF EXISTS v_rateations_with_kpis;

CREATE OR REPLACE VIEW v_rateations_with_kpis AS
WITH 
  tz_now AS (
    SELECT (now() AT TIME ZONE 'Europe/Rome')::date AS d
  ),
  inst AS (
    SELECT
      i.rateation_id,
      -- Amounts in cents, rounded to avoid floating point issues
      ROUND(i.amount::numeric * 100)::bigint AS amount_cents,
      COALESCE(i.is_paid, false) AS is_paid,
      i.due_date::date AS due_date
    FROM installments i
  ),
  agg AS (
    SELECT
      rateation_id,
      COUNT(*) AS rate_totali,
      SUM(amount_cents) AS total_amount_cents,
      SUM(CASE WHEN is_paid THEN amount_cents ELSE 0 END) AS paid_amount_cents,
      SUM(CASE WHEN NOT is_paid THEN amount_cents ELSE 0 END) AS unpaid_amount_cents,
      SUM(CASE WHEN NOT is_paid AND due_date < (SELECT d FROM tz_now) 
               THEN amount_cents ELSE 0 END) AS overdue_amount_cents,
      SUM(CASE WHEN NOT is_paid AND due_date = (SELECT d FROM tz_now) 
               THEN amount_cents ELSE 0 END) AS due_today_cents,
      COUNT(*) FILTER (WHERE is_paid) AS rate_pagate,
      COUNT(*) FILTER (WHERE NOT is_paid AND due_date < (SELECT d FROM tz_now)) AS rate_in_ritardo
    FROM inst
    GROUP BY rateation_id
  ),
  pagopa_kpis AS (
    SELECT DISTINCT
      rateation_id,
      unpaid_overdue_today,
      unpaid_count,
      skip_remaining,
      at_risk_decadence
    FROM v_pagopa_unpaid_today
  ),
  pagopa_kpis_extended AS (
    SELECT DISTINCT
      rateation_id,
      max_skips_effective
    FROM v_pagopa_today_kpis
  ),
  debt_stats AS (
    SELECT
      rd.rateation_id,
      COUNT(*) AS debts_total,
      COUNT(*) FILTER (WHERE rd.status = 'migrated_out') AS debts_migrated,
      ARRAY_AGG(d.number) FILTER (WHERE rd.status = 'migrated_out') AS migrated_debt_numbers,
      ARRAY_AGG(d.number) FILTER (WHERE rd.status = 'active') AS remaining_debt_numbers,
      ARRAY_AGG(rd.target_rateation_id) FILTER (WHERE rd.status = 'migrated_out') AS rq_target_ids
    FROM rateation_debts rd
    JOIN debts d ON d.id = rd.debt_id
    GROUP BY rd.rateation_id
  )
SELECT 
  r.id,
  r.owner_uid,
  r.number,
  r.taxpayer_name,
  r.status,
  r.created_at,
  r.updated_at,
  r.is_f24,
  r.type_id,
  t.name AS tipo,
  
  -- KPI amounts calculated ONLY from installments (realtime, timezone-safe)
  COALESCE(agg.rate_totali, 0) AS rate_totali,
  COALESCE(agg.rate_pagate, 0) AS rate_pagate,
  COALESCE(agg.rate_in_ritardo, 0) AS rate_in_ritardo,
  COALESCE(agg.total_amount_cents, 0) AS total_amount_cents,
  COALESCE(agg.paid_amount_cents, 0) AS paid_amount_cents,
  COALESCE(agg.overdue_amount_cents, 0) AS overdue_amount_cents,
  COALESCE(agg.due_today_cents, 0) AS due_today_cents,
  
  -- Residual calculated with GREATEST to prevent negatives
  GREATEST(0, 
    COALESCE(agg.total_amount_cents, 0) - COALESCE(agg.paid_amount_cents, 0)
  ) AS residual_amount_cents,
  
  -- Legacy total_amount field for compatibility
  r.total_amount,
  
  -- PagoPA KPIs from separate views
  COALESCE(pk.unpaid_overdue_today, 0) AS unpaid_overdue_today,
  COALESCE(pk.unpaid_count, 0) AS unpaid_due_today,
  COALESCE(pke.max_skips_effective, 8) AS max_skips_effective,
  COALESCE(pk.skip_remaining, 8) AS skip_remaining,
  COALESCE(pk.at_risk_decadence, false) AS at_risk_decadence,
  
  -- PagoPA detection logic
  (UPPER(COALESCE(t.name, '')) = 'PAGOPA') AS is_pagopa,
  
  -- Migration fields
  COALESCE(ds.debts_total, 0) AS debts_total,
  COALESCE(ds.debts_migrated, 0) AS debts_migrated,
  COALESCE(ds.migrated_debt_numbers, ARRAY[]::text[]) AS migrated_debt_numbers,
  COALESCE(ds.remaining_debt_numbers, ARRAY[]::text[]) AS remaining_debt_numbers,
  COALESCE(ds.rq_target_ids, ARRAY[]::bigint[]) AS rq_target_ids,
  
  -- Migration status logic
  CASE 
    WHEN ds.debts_total > 0 AND ds.debts_migrated = ds.debts_total THEN 'migrated'
    WHEN ds.debts_total > 0 AND ds.debts_migrated > 0 THEN 'partial'
    WHEN ds.debts_total > 0 THEN 'pending'
    ELSE 'none'
  END AS rq_migration_status,
  
  -- Exclusion logic: exclude RQ types from main stats
  (UPPER(COALESCE(t.name, '')) = 'RQ') AS excluded_from_stats

FROM rateations r
LEFT JOIN agg ON agg.rateation_id = r.id
LEFT JOIN rateation_types t ON t.id = r.type_id
LEFT JOIN pagopa_kpis pk ON pk.rateation_id = r.id
LEFT JOIN pagopa_kpis_extended pke ON pke.rateation_id = r.id
LEFT JOIN debt_stats ds ON ds.rateation_id = r.id;