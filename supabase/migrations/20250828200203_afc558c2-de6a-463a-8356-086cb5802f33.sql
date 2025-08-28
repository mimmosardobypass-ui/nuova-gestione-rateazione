-- Complete the test setup with RQ plan and debt links

-- Create one RQ plan for the same owner as the PagoPA plans
INSERT INTO rateations (number, type_id, taxpayer_name, total_amount, status, owner_uid)
SELECT 
  'RQ-TEST-001', 
  rt.id, 
  'Piano RQ Test Destinazione', 
  0, 
  'attiva',
  r.owner_uid
FROM rateation_types rt, rateations r
WHERE rt.name = 'RQ' 
  AND r.id = 31 -- Use same owner as PagoPA plan 31
  AND NOT EXISTS (SELECT 1 FROM rateations WHERE number = 'RQ-TEST-001');

-- Link test debts to PagoPA plan 31 for migration testing
INSERT INTO rateation_debts (rateation_id, debt_id, status)
SELECT 31, d.id, 'active'
FROM debts d
WHERE d.number IN ('TEST-DEBT-A', 'TEST-DEBT-B')
  AND NOT EXISTS (
    SELECT 1 FROM rateation_debts rd 
    WHERE rd.rateation_id = 31 AND rd.debt_id = d.id
  );