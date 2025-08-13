-- Delete demo record
DELETE FROM public.rateations WHERE number = 'RAT-001';

-- Also delete any related installments for safety
DELETE FROM public.installments WHERE rateation_id IN (
  SELECT id FROM public.rateations WHERE number = 'RAT-001'
);