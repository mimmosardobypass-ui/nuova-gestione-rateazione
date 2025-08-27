-- Update the canonical view with timezone, is_paid coercion, and is_pagopa field
CREATE OR REPLACE VIEW public.v_rateations_with_kpis AS
WITH base AS (
  SELECT
    r.id                                        AS rateation_id,
    r.created_at,
    r.updated_at,
    r.owner_uid,
    r.number,
    r.taxpayer_name,
    r.type_id,
    r.total_amount,
    r.status,
    r.is_f24,
    rt.name                                     AS tipo,
    (NOW() AT TIME ZONE 'Europe/Rome')::date   AS today_it
  FROM public.rateations r
  LEFT JOIN public.rateation_types rt ON r.type_id = rt.id
),
it AS (
  SELECT
    i.rateation_id,
    COALESCE(i.amount_cents, (i.amount * 100)::bigint, 0) AS amount_cents,
    CASE
      WHEN i.is_paid::text IN ('1','true','t','TRUE','T') THEN true
      WHEN i.is_paid::text IN ('0','false','f','FALSE','F') THEN false
      ELSE COALESCE(i.is_paid::boolean, false)
    END                           AS paid_bool,
    i.due_date::date              AS due_dt,
    i.paid_at::date               AS paid_dt
  FROM public.installments i
),
agg AS (
  SELECT
    b.rateation_id                                                AS id,
    b.created_at,
    b.updated_at,
    b.owner_uid,
    b.number,
    b.taxpayer_name,
    b.type_id,
    b.total_amount,
    b.status,
    b.is_f24,
    COALESCE(b.tipo,'N/A')                                        AS tipo,

    COUNT(*)                                                      AS rate_totali,
    COUNT(*) FILTER (WHERE it.paid_bool)                          AS rate_pagate,
    COUNT(*) FILTER (WHERE it.paid_bool = false)                  AS rate_non_pagate,

    COUNT(*) FILTER (WHERE it.paid_bool = false AND it.due_dt < b.today_it) AS unpaid_overdue_today,
    COUNT(*) FILTER (WHERE it.paid_bool = false AND it.due_dt = b.today_it) AS unpaid_due_today,

    SUM(it.amount_cents)                                          AS total_amount_cents,
    COALESCE(SUM(it.amount_cents) FILTER (WHERE it.paid_bool), 0) AS paid_amount_cents,
    COALESCE(SUM(it.amount_cents) FILTER (WHERE it.paid_bool = false), 0) AS residual_amount_cents,
    COALESCE(SUM(it.amount_cents) FILTER (WHERE it.paid_bool = false AND it.due_dt < b.today_it), 0) AS overdue_amount_cents
  FROM base b
  LEFT JOIN it ON it.rateation_id = b.rateation_id
  GROUP BY b.rateation_id, b.created_at, b.updated_at, b.owner_uid, b.number, b.taxpayer_name, b.type_id, b.total_amount, b.status, b.is_f24, b.tipo, b.today_it
)
SELECT
  a.*,
  8                                                   AS max_skips_effective,
  GREATEST(0, 8 - a.unpaid_overdue_today)            AS skip_remaining,
  (a.unpaid_overdue_today >= 8)                       AS at_risk_decadence,
  (UPPER(a.tipo) = 'PAGOPA')                          AS is_pagopa,
  -- Legacy computed fields for compatibility
  (a.residual_amount_cents::numeric / 100)            AS residuo,
  a.unpaid_overdue_today                              AS rate_in_ritardo
FROM agg a
ORDER BY a.created_at DESC, a.id DESC;

-- Backfill owner_uid alignment between installments and rateations
UPDATE installments i
SET owner_uid = r.owner_uid
FROM rateations r
WHERE i.rateation_id = r.id
  AND (i.owner_uid IS NULL OR i.owner_uid <> r.owner_uid);

-- Add performance indexes
CREATE INDEX IF NOT EXISTS idx_installments_rateation_id ON installments(rateation_id);
CREATE INDEX IF NOT EXISTS idx_rateations_owner_uid ON rateations(owner_uid);
CREATE INDEX IF NOT EXISTS idx_installments_owner_uid ON installments(owner_uid);
CREATE INDEX IF NOT EXISTS idx_installments_due_date ON installments(due_date);