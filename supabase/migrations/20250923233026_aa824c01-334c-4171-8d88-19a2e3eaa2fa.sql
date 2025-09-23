-- Create canonical view for rateations list UI
CREATE OR REPLACE VIEW v_rateations_list_ui AS
WITH
-- rateazioni base
r AS (
  SELECT
    ra.id,
    ra.owner_uid,
    ra.status,
    ra.number,
    ra.taxpayer_name,
    ra.is_f24,
    ra.is_quater,
    ra.created_at,
    ra.updated_at,
    ra.type_id,
    rt.name as tipo
  FROM rateations ra
  LEFT JOIN rateation_types rt ON rt.id = ra.type_id
),

-- aggregati monetari dalle installments (usando amount in euro, convertito in cents)
inst AS (
  SELECT
    i.rateation_id,
    sum(COALESCE(i.amount, 0) * 100)::bigint                    AS total_amount_cents,
    sum(CASE 
      WHEN i.is_paid = true 
      THEN COALESCE(i.paid_total_cents, i.amount * 100, 0) 
      ELSE 0 
    END)::bigint                                                AS paid_amount_cents,
    sum(CASE
      WHEN i.due_date < CURRENT_DATE AND i.is_paid = false
      THEN COALESCE(i.amount, 0) * 100
      ELSE 0
    END)::bigint                                                AS overdue_effective_cents,
    count(*)                                                    AS installments_total,
    count(*) FILTER (WHERE i.is_paid = true)                   AS installments_paid,
    count(*) FILTER (
      WHERE i.due_date < CURRENT_DATE AND i.is_paid = false
    )                                                           AS installments_overdue_today
  FROM installments i
  GROUP BY i.rateation_id
)

SELECT
  r.id,
  r.owner_uid,
  r.status,
  r.tipo,
  r.number,
  r.taxpayer_name,
  r.is_f24,
  r.is_quater,
  r.created_at,
  r.updated_at,
  r.type_id,

  COALESCE(inst.total_amount_cents, 0)                         AS total_amount_cents,
  COALESCE(inst.paid_amount_cents, 0)                          AS paid_amount_cents,
  COALESCE(inst.overdue_effective_cents, 0)                    AS overdue_effective_cents,
  GREATEST(0, COALESCE(inst.total_amount_cents, 0) - 
              COALESCE(inst.paid_amount_cents, 0))             AS residual_effective_cents,

  COALESCE(inst.installments_total, 0)                         AS installments_total,
  COALESCE(inst.installments_paid, 0)                          AS installments_paid,
  COALESCE(inst.installments_overdue_today, 0)                AS installments_overdue_today
FROM r
LEFT JOIN inst ON inst.rateation_id = r.id;

-- Grant permissions
GRANT SELECT ON v_rateations_list_ui TO authenticated;