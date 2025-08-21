-- Fix the 2F24DEC plan: set correct status to 'decaduta' and update snapshot
UPDATE rateations 
SET status = 'decaduta',
    decadence_at = COALESCE(decadence_at, NOW()),
    residual_at_decadence_cents = residual_amount_cents
WHERE number = '2F24DEC';

-- Verify both plans now have correct status and snapshots
SELECT 
  r.id, 
  r.number, 
  r.status,
  r.residual_amount_cents / 100.0 as residual_amount_euro,
  r.residual_at_decadence_cents / 100.0 as residual_at_decadence_euro
FROM rateations r 
WHERE r.number IN ('1F24', '2F24DEC')
ORDER BY r.id;