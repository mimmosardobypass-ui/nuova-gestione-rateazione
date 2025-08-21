-- Fix data inconsistencies for 2F24DEC plan and recalculate totals

-- Step 1: Fix amount_cents for all installments where it's null
UPDATE installments 
SET amount_cents = (amount * 100)::bigint
WHERE amount_cents IS NULL AND amount IS NOT NULL;

-- Step 2: Recalculate totals for all affected rateations
-- This will update paid_amount_cents, residual_amount_cents, overdue_amount_cents
SELECT rateations_recalc_totals(id) 
FROM rateations 
WHERE id IN (
  SELECT DISTINCT rateation_id 
  FROM installments 
  WHERE amount_cents IS NOT NULL
);

-- Step 3: Update residual_at_decadence_cents for 2F24DEC plan to match current residual
UPDATE rateations 
SET residual_at_decadence_cents = residual_amount_cents
WHERE number LIKE '%2F24DEC%' AND status = 'decaduta';

-- Verify the fix
SELECT 
  r.id, 
  r.number, 
  r.total_amount,
  r.paid_amount_cents / 100.0 as paid_amount_euro,
  r.residual_amount_cents / 100.0 as residual_amount_euro,
  r.residual_at_decadence_cents / 100.0 as residual_at_decadence_euro
FROM rateations r 
WHERE r.number IN ('1F24', '2F24DEC')
ORDER BY r.id;