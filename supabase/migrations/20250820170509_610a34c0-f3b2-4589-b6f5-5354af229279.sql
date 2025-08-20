-- Step 1: Backfill dei centesimi per tutte le rate mancanti
UPDATE installments 
SET amount_cents = (amount * 100)::bigint 
WHERE amount_cents IS NULL AND amount IS NOT NULL;

-- Step 2: Ricalcola TUTTI i piani esistenti
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM rateations LOOP
    PERFORM rateations_recalc_totals(r.id);
  END LOOP;
END$$;

-- Step 3: Verifiche finali
-- Controlla che non ci siano più amount_cents mancanti
SELECT count(*) AS missing_amount_cents_after_fix
FROM installments
WHERE amount_cents IS NULL;

-- Verifica totali piano F24 (ID=21) dopo la correzione
SELECT id, number,
       paid_amount_cents/100.0     AS paid_amount_euro,
       residual_amount_cents/100.0 AS residual_amount_euro,
       overdue_amount_cents/100.0  AS overdue_amount_euro
FROM rateations
WHERE id = 21;

-- Verifica stato rata 31/12/2024 del piano F24
SELECT id, seq, due_date, is_paid, paid_at, amount_cents/100.0 AS amount
FROM installments
WHERE rateation_id = 21 AND due_date = '2024-12-31';

-- Dashboard decaduto (dovrebbe essere 0 finché non si confermano decadenze)
SELECT * FROM v_dashboard_decaduto;