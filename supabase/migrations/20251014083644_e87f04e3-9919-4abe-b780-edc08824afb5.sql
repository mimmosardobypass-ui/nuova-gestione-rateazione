-- Fix type normalization in v_rateations_stats_v3 to properly handle all Quater variants
-- This ensures that generic "Quater" types are mapped to RIAMMISSIONE_QUATER

DROP VIEW IF EXISTS v_rateations_stats_v3 CASCADE;

CREATE OR REPLACE VIEW v_rateations_stats_v3 AS
SELECT
  r.id,
  r.owner_uid,
  r.number,
  r.taxpayer_name,
  r.created_at,
  LOWER(COALESCE(r.status, 'attiva')) AS status,
  
  -- Enhanced type normalization
  CASE
    WHEN UPPER(COALESCE(rt.name, '')) = 'F24' THEN 'F24'
    WHEN UPPER(COALESCE(rt.name, '')) LIKE '%PAGOPA%' THEN 'PAGOPA'
    -- Map all Quater variants (Riam.Quater, Quater, Riammissione Quater) to RIAMMISSIONE_QUATER
    WHEN UPPER(COALESCE(rt.name, '')) LIKE '%QUATER%' THEN 'RIAMMISSIONE_QUATER'
    ELSE 'ALTRO'
  END AS type,

  -- Total amounts in cents
  COALESCE((SELECT SUM(i.amount_cents) FROM installments i WHERE i.rateation_id = r.id), 0) AS total_cents,
  
  -- Paid amounts in cents
  COALESCE((SELECT SUM(i.amount_cents) FROM installments i WHERE i.rateation_id = r.id AND i.is_paid = true), 0) AS paid_cents,
  
  -- Residual amounts in cents (unpaid installments)
  COALESCE((SELECT SUM(i.amount_cents) FROM installments i WHERE i.rateation_id = r.id AND i.is_paid = false), 0) AS residual_cents,
  
  -- Overdue amounts in cents (unpaid and past due date)
  COALESCE((SELECT SUM(i.amount_cents) FROM installments i WHERE i.rateation_id = r.id AND i.is_paid = false AND i.due_date < CURRENT_DATE), 0) AS overdue_cents,
  
  -- Decayed amounts (for decayed rateations)
  CASE 
    WHEN LOWER(COALESCE(r.status, 'attiva')) = 'decaduta' THEN COALESCE(r.residual_at_decadence_cents, 0)
    ELSE 0
  END AS decayed_cents,

  -- Installment counts
  COALESCE((SELECT COUNT(*) FROM installments i WHERE i.rateation_id = r.id), 0) AS installments_total,
  COALESCE((SELECT COUNT(*) FROM installments i WHERE i.rateation_id = r.id AND i.is_paid = true), 0) AS installments_paid,
  
  -- First due date (for sorting/filtering)
  (SELECT MIN(i.due_date) FROM installments i WHERE i.rateation_id = r.id) AS first_due_date,
  
  -- Completion percentage
  CASE 
    WHEN COALESCE((SELECT SUM(i.amount_cents) FROM installments i WHERE i.rateation_id = r.id), 0) > 0 
    THEN ROUND(
      (COALESCE((SELECT SUM(i.amount_cents) FROM installments i WHERE i.rateation_id = r.id AND i.is_paid = true), 0)::numeric 
      / COALESCE((SELECT SUM(i.amount_cents) FROM installments i WHERE i.rateation_id = r.id), 0)::numeric) * 100, 
      2
    )
    ELSE 0
  END AS completion_percent

FROM rateations r
LEFT JOIN rateation_types rt ON rt.id = r.type_id
WHERE COALESCE(r.is_deleted, false) = false;