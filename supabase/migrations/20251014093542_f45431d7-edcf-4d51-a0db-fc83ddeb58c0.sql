-- Fix PagoPa linked to RQ that should be INTERROTTA
-- Update the 4 PagoPa rateations (N.19, 20, 32, 36 / IDs: 39, 40, 53, 57) to INTERROTTA status
UPDATE rateations
SET status = 'INTERROTTA',
    interruption_reason = COALESCE(interruption_reason, 'RQ_LINK'),
    interrupted_at = COALESCE(interrupted_at, CURRENT_DATE)
WHERE id IN (39, 40, 53, 57)
  AND status != 'INTERROTTA';

-- Update v_rateations_stats_v3 to preserve INTERROTTA status before grouping in_ritardo with attiva
DROP VIEW IF EXISTS v_rateations_stats_v3 CASCADE;

CREATE OR REPLACE VIEW v_rateations_stats_v3 AS
SELECT
  r.id,
  r.owner_uid,
  r.number,
  r.taxpayer_name,
  r.created_at,
  
  -- Normalize status: preserve INTERROTTA first, then group 'in_ritardo' with 'attiva'
  CASE
    WHEN UPPER(COALESCE(r.status, 'attiva')) = 'INTERROTTA' THEN 'interrotta'
    WHEN LOWER(COALESCE(r.status, 'attiva')) IN ('in_ritardo', 'attiva') THEN 'attiva'
    ELSE LOWER(COALESCE(r.status, 'attiva'))
  END AS status,
  
  -- Enhanced type normalization
  CASE
    WHEN UPPER(COALESCE(rt.name, '')) = 'F24' THEN 'F24'
    WHEN UPPER(COALESCE(rt.name, '')) LIKE '%PAGOPA%' THEN 'PAGOPA'
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