-- Set 1F24 plan to 'decaduta' status as it also has a decayed balance
UPDATE rateations 
SET status = 'decaduta',
    decadence_at = COALESCE(decadence_at, NOW())
WHERE number = '1F24' AND residual_at_decadence_cents > 0;

-- Verify both F24 plans are now marked as decayed
SELECT 
  id, number, status, 
  residual_at_decadence_cents / 100.0 as residual_at_decadence_euro
FROM rateations 
WHERE number IN ('1F24', '2F24DEC')
ORDER BY id;

-- Check the dashboard view now includes both plans
SELECT 
  gross_decayed_cents / 100.0 as gross_decayed_euro,
  transferred_cents / 100.0 as transferred_euro,
  net_to_transfer_cents / 100.0 as net_to_transfer_euro
FROM v_dashboard_decaduto;