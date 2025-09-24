-- Legacy data cleanup and upsert improvements

-- 1. Cleanup allocazioni zero (legacy data)
DELETE FROM riam_quater_links 
WHERE allocated_residual_cents IS NULL OR allocated_residual_cents <= 0;

-- 2. Backfill per link storici senza allocated_residual_cents
-- Usa pagopa_residual_at_link_cents come fallback per link pre-quota
UPDATE riam_quater_links 
SET allocated_residual_cents = COALESCE(
  allocated_residual_cents,
  pagopa_residual_at_link_cents,
  0
)
WHERE allocated_residual_cents IS NULL;

-- 3. Assicura che tutti i link abbiano una quota valida
UPDATE riam_quater_links 
SET allocated_residual_cents = GREATEST(allocated_residual_cents, 1)
WHERE allocated_residual_cents <= 0;

-- 4. Aggiungi constraint per prevenire allocazioni zero future
ALTER TABLE riam_quater_links 
ADD CONSTRAINT chk_allocated_positive 
CHECK (allocated_residual_cents > 0);