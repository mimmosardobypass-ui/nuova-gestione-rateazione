-- Phase 1: Database Schema Updates for F24 Decadence Management

-- 1.1 ALTER TABLE rateations - Add decadence columns
ALTER TABLE rateations
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS is_f24 boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS decadence_at timestamptz,
  ADD COLUMN IF NOT EXISTS decadence_installment_id bigint,
  ADD COLUMN IF NOT EXISTS decadence_confirmed_by uuid,
  ADD COLUMN IF NOT EXISTS decadence_reason text,
  ADD COLUMN IF NOT EXISTS residual_at_decadence numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transferred_amount numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS replaced_by_rateation_id bigint;

-- Create useful indexes
CREATE INDEX IF NOT EXISTS idx_rateations_status ON rateations(status);
CREATE INDEX IF NOT EXISTS idx_rateations_is_f24 ON rateations(is_f24);
CREATE INDEX IF NOT EXISTS idx_installments_paid_date ON installments(paid_date);
CREATE INDEX IF NOT EXISTS idx_installments_due_date ON installments(due_date);

-- 1.2 Vista "Saldo Decaduto"
CREATE OR REPLACE VIEW v_dashboard_decaduto AS
SELECT
  COALESCE(SUM(r.residual_at_decadence), 0)::numeric(14,2) AS gross_decayed,
  COALESCE(SUM(r.transferred_amount), 0)::numeric(14,2) AS transferred,
  COALESCE(SUM(r.residual_at_decadence - r.transferred_amount), 0)::numeric(14,2) AS net_to_transfer
FROM rateations r
WHERE r.status = 'decaduta';

-- 1.3 Vista elenco piani decaduti
CREATE OR REPLACE VIEW v_decadute_dettaglio AS
SELECT
  r.id,
  r.numero,
  r.taxpayer_name,
  r.decadence_at,
  r.residual_at_decadence,
  r.transferred_amount,
  (r.residual_at_decadence - r.transferred_amount) AS to_transfer,
  r.replaced_by_rateation_id
FROM rateations r
WHERE r.status = 'decaduta'
ORDER BY r.decadence_at DESC NULLS LAST, r.id DESC;

-- 1.4 Vista rate con "effective_status"
CREATE OR REPLACE VIEW v_installments_effective AS
SELECT
  i.*,
  r.status AS rateation_status,
  CASE
    WHEN r.status = 'decaduta' AND i.paid_date IS NULL THEN 'decayed'
    WHEN i.paid_date IS NOT NULL THEN 'paid'
    WHEN NOW()::date > i.due_date THEN 'overdue'
    ELSE 'open'
  END AS effective_status
FROM installments i
JOIN rateations r ON r.id = i.rateation_id;

-- 2. RPC Functions for Decadence Management

-- 2.1 Flag automatico "Pre-decadenza"
CREATE OR REPLACE FUNCTION rateation_auto_flag_predecadence()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE rateations r
  SET status = 'decadence_pending'
  WHERE r.is_f24 = true
    AND r.status = 'active'
    AND EXISTS (
      SELECT 1
      FROM installments i
      WHERE i.rateation_id = r.id
        AND i.paid_date IS NULL
        AND (NOW()::date - i.due_date) > 90
    );
END;
$$;

-- 2.2 Conferma decadenza (azione manuale)
CREATE OR REPLACE FUNCTION rateation_confirm_decadence(
  p_rateation_id bigint,
  p_installment_id bigint,
  p_reason text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_residual numeric(14,2);
BEGIN
  -- Check ownership
  IF NOT EXISTS(SELECT 1 FROM rateations WHERE id = p_rateation_id AND owner_uid = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Idempotenza basica
  IF (SELECT status FROM rateations WHERE id = p_rateation_id) = 'decaduta' THEN
    RETURN;
  END IF;

  -- Calcolo residuo su rate NON pagate (quota capitale)
  SELECT COALESCE(SUM(i.amount), 0)::numeric(14,2)
  INTO v_residual
  FROM installments i
  WHERE i.rateation_id = p_rateation_id
    AND i.paid_date IS NULL;

  UPDATE rateations
  SET status = 'decaduta',
      decadence_at = NOW(),
      decadence_installment_id = p_installment_id,
      decadence_reason = p_reason,
      decadence_confirmed_by = auth.uid(),
      residual_at_decadence = v_residual
  WHERE id = p_rateation_id;
END;
$$;

-- 2.3 Collegare il decaduto ad una nuova rateazione PagoPA
CREATE OR REPLACE FUNCTION rateation_link_transfer(
  p_f24_id bigint,
  p_pagopa_id bigint,
  p_amount numeric
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_left numeric(14,2);
BEGIN
  -- Check ownership
  IF NOT EXISTS(SELECT 1 FROM rateations WHERE id = p_f24_id AND owner_uid = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT (residual_at_decadence - transferred_amount)
  INTO v_left
  FROM rateations
  WHERE id = p_f24_id;

  IF p_amount <= 0 OR p_amount > v_left THEN
    RAISE EXCEPTION 'Importo trasferimento non valido. Rimasto: %', v_left;
  END IF;

  UPDATE rateations
  SET transferred_amount = transferred_amount + p_amount,
      replaced_by_rateation_id = p_pagopa_id
  WHERE id = p_f24_id;
END;
$$;