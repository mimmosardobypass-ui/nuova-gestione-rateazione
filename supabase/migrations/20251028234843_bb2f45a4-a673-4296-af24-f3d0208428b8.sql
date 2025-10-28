-- Create view for monthly metrics by type
-- Groups installments by (owner_uid, year, month, type_label)
-- Used for "Statistica Scadenze" matrix page

CREATE OR REPLACE VIEW v_monthly_metrics_by_type AS
SELECT 
  i.owner_uid,
  EXTRACT(YEAR FROM i.due_date)::integer AS year,
  EXTRACT(MONTH FROM i.due_date)::integer AS month,
  COALESCE(vtl.type_label, 'ALTRO') AS type_label,
  
  -- Importi dovuti (tutte le rate del mese, basati su amount_cents)
  SUM(COALESCE(i.amount_cents, 0)) AS due_amount_cents,
  
  -- Importi pagati (solo rate pagate)
  SUM(CASE 
    WHEN i.is_paid = true AND i.paid_at IS NOT NULL 
    THEN COALESCE(i.amount_cents, 0) 
    ELSE 0 
  END) AS paid_amount_cents,
  
  -- Importi in ritardo (scadute e non pagate)
  SUM(CASE 
    WHEN i.is_paid = false 
         AND i.paid_at IS NULL 
         AND i.due_date < CURRENT_DATE
         AND i.canceled_at IS NULL
    THEN COALESCE(i.amount_cents, 0) 
    ELSE 0 
  END) AS overdue_amount_cents,
  
  -- Extra ravvedimento pagato
  SUM(CASE 
    WHEN i.is_paid = true AND i.paid_at IS NOT NULL 
    THEN (COALESCE(i.penalty_amount_cents, 0) + COALESCE(i.interest_amount_cents, 0))
    ELSE 0 
  END) AS extra_ravv_amount_cents,
  
  -- Conteggi
  COUNT(*) AS installments_count,
  COUNT(CASE WHEN i.is_paid = true THEN 1 END) AS paid_count
  
FROM installments i
INNER JOIN rateations r ON r.id = i.rateation_id
LEFT JOIN v_rateation_type_label vtl ON vtl.id = r.id
WHERE 
  r.is_deleted = false
  AND i.canceled_at IS NULL
  AND r.status NOT IN ('estinta')
GROUP BY 
  i.owner_uid, 
  year, 
  month, 
  vtl.type_label
ORDER BY 
  year, 
  month, 
  type_label;