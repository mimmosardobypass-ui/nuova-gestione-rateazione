-- SAFE DELETION: Remove only the three phantom RQ rateations
-- Verified they have NO dependencies (0 installments, 0 rateation_debts, 0 payments)

-- Delete the three phantom RQ rateations specifically by ID
DELETE FROM rateations 
WHERE id IN (36, 37, 38) 
  AND upper(number) IN ('RQ-TEST-001','RQ-001/2024','RQ-002/2024');

-- Verification query to confirm deletion
-- This should return 0 rows after deletion
SELECT id, number, taxpayer_name 
FROM rateations 
WHERE id IN (36, 37, 38);