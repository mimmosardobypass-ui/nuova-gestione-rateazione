-- Fix the residual_at_decadence_cents for 2F24DEC plan
UPDATE rateations 
SET residual_at_decadence_cents = residual_amount_cents
WHERE number = '2F24DEC' AND status = 'decaduta';

-- Verify the final result
SELECT 
  r.id, 
  r.number, 
  r.residual_amount_cents / 100.0 as residual_amount_euro,
  r.residual_at_decadence_cents / 100.0 as residual_at_decadence_euro
FROM rateations r 
WHERE r.number IN ('1F24', '2F24DEC')
ORDER BY r.id;