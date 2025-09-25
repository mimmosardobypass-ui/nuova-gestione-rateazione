-- Step 1: Fix N.31's corrupted data
UPDATE installments 
SET amount_cents = (amount * 100)::bigint
WHERE rateation_id = 52 AND amount_cents IS NULL;

UPDATE rateations 
SET residual_amount_cents = (
  SELECT COALESCE(SUM(i.amount_cents), 0)
  FROM installments i 
  WHERE i.rateation_id = 52 AND i.is_paid = false
),
paid_amount_cents = (
  SELECT COALESCE(SUM(i.amount_cents), 0)
  FROM installments i 
  WHERE i.rateation_id = 52 AND i.is_paid = true
)
WHERE id = 52;