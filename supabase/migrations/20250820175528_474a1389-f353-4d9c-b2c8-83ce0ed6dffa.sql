-- Ensure safe search path
SET search_path TO public;

-- 1A) Hardening vista confermata (già usata dalla card) 
-- Usa i campi corretti dello schema
DROP VIEW IF EXISTS v_dashboard_decaduto CASCADE;
CREATE VIEW v_dashboard_decaduto AS
SELECT
  COALESCE(SUM(residual_at_decadence_cents), 0) AS gross_decayed,
  COALESCE(SUM((transferred_amount * 100)::bigint), 0) AS transferred,
  COALESCE(SUM(residual_at_decadence_cents - (transferred_amount * 100)::bigint), 0) AS net_to_transfer
FROM rateations
WHERE status = 'decaduta';

-- 1B) Nuova vista: PREVIEW delle decadenze NON confermate
-- regola: F24 con almeno 1 rata non pagata scaduta da > 90 giorni e stato non 'decaduta'
DROP VIEW IF EXISTS v_dashboard_decaduto_preview CASCADE;
CREATE VIEW v_dashboard_decaduto_preview AS
WITH candidate AS (
  SELECT r.id
  FROM rateations r
  JOIN installments i ON i.rateation_id = r.id
  WHERE r.is_f24 = TRUE
    AND r.status IN ('active','decadence_pending')
  GROUP BY r.id
  HAVING MAX(
    CASE 
      WHEN i.is_paid = FALSE AND i.due_date < (CURRENT_DATE - INTERVAL '90 days')
      THEN 1 ELSE 0
    END
  ) = 1
)
SELECT 
  COALESCE(SUM(i.amount_cents), 0) AS potential_gross_decayed_cents
FROM installments i
JOIN candidate c ON c.id = i.rateation_id
WHERE i.is_paid = FALSE;

-- 1C) Indici per performance (idempotenti)
CREATE INDEX IF NOT EXISTS ix_installments_due_overdue
  ON installments (due_date)
  WHERE is_paid = FALSE;

CREATE INDEX IF NOT EXISTS ix_installments_rateation_paid
  ON installments (rateation_id, is_paid);

CREATE INDEX IF NOT EXISTS ix_rateations_status_isf24
  ON rateations (status, is_f24);