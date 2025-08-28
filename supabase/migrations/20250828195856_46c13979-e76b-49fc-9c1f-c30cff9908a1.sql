-- Just create the missing debt links for PagoPA plans
-- Clear any existing conflicting records and create fresh test links

-- First, remove any existing test debt links to start fresh
DELETE FROM rateation_debts 
WHERE debt_id IN (
  SELECT id FROM debts WHERE number LIKE 'DEBT-%2024'
);

-- Create clean links between PagoPA plans and debts
INSERT INTO rateation_debts (rateation_id, debt_id, status) 
VALUES 
  -- Plan 27: DEBT-001 and DEBT-002
  (27, (SELECT id FROM debts WHERE number = 'DEBT-001-2024'), 'active'),
  (27, (SELECT id FROM debts WHERE number = 'DEBT-002-2024'), 'active'),
  
  -- Plan 28: DEBT-002 and DEBT-003  
  (28, (SELECT id FROM debts WHERE number = 'DEBT-002-2024'), 'active'),
  (28, (SELECT id FROM debts WHERE number = 'DEBT-003-2024'), 'active'),
  
  -- Plan 31: DEBT-001, DEBT-002, DEBT-003 (for comprehensive testing)
  (31, (SELECT id FROM debts WHERE number = 'DEBT-001-2024'), 'active'),
  (31, (SELECT id FROM debts WHERE number = 'DEBT-003-2024'), 'active'),
  (31, (SELECT id FROM debts WHERE number = 'DEBT-004-2024'), 'active');