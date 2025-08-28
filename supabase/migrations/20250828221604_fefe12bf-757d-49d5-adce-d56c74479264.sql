-- Fix data consistency: populate missing amount_cents values for rateations and installments

-- Step 1: Update installments - convert amount (euros) to amount_cents (cents)
UPDATE installments 
SET amount_cents = ROUND(amount * 100)
WHERE amount_cents IS NULL AND amount IS NOT NULL;

-- Step 2: Refresh the materialized view or trigger recalculation
-- The view v_rateations_with_kpis should automatically recalculate based on the updated installment data

-- Step 3: Update rateations table cached amounts (if they exist and are stale)
UPDATE rateations 
SET 
  paid_amount_cents = COALESCE((
    SELECT SUM(CASE WHEN is_paid THEN ROUND(amount * 100) ELSE 0 END)
    FROM installments 
    WHERE installments.rateation_id = rateations.id
  ), 0),
  overdue_amount_cents = COALESCE((
    SELECT SUM(CASE WHEN NOT is_paid AND due_date < CURRENT_DATE THEN ROUND(amount * 100) ELSE 0 END)
    FROM installments 
    WHERE installments.rateation_id = rateations.id
  ), 0),
  residual_amount_cents = COALESCE((
    SELECT SUM(CASE WHEN NOT is_paid THEN ROUND(amount * 100) ELSE 0 END)
    FROM installments 
    WHERE installments.rateation_id = rateations.id
  ), 0)
WHERE id IN (31, 32);