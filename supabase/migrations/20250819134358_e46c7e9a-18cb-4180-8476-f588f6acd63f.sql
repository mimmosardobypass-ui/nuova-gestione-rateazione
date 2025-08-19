-- 1) Add clear fields to installments table
ALTER TABLE installments
  ADD COLUMN IF NOT EXISTS payment_mode text
    CHECK (payment_mode IN ('ordinary','ravvedimento','partial')),
  ADD COLUMN IF NOT EXISTS paid_date date,
  ADD COLUMN IF NOT EXISTS extra_interest_euro numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_penalty_euro numeric DEFAULT 0;

-- 2) Create ledger for payment movements (recommended for audit trail)
CREATE TABLE IF NOT EXISTS installment_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  installment_id bigint NOT NULL REFERENCES installments(id) ON DELETE CASCADE,
  paid_date date NOT NULL,
  kind text CHECK (kind IN ('principal','interest','penalty')) NOT NULL,
  amount numeric NOT NULL,
  note text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_installment_payments_installment ON installment_payments(installment_id);

-- 3) Function: ordinary payment (NO extra charges)
CREATE OR REPLACE FUNCTION mark_installment_paid_ordinary_new(
  p_installment_id bigint,
  p_paid_date date,
  p_amount_paid numeric DEFAULT null
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_principal numeric;
BEGIN
  SELECT amount INTO v_principal FROM installments WHERE id = p_installment_id AND owner_uid = auth.uid() FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Installment not found or access denied';
  END IF;

  -- Record payment in ledger
  INSERT INTO installment_payments (installment_id, paid_date, kind, amount)
  VALUES (p_installment_id, p_paid_date, 'principal', COALESCE(p_amount_paid, v_principal));

  -- Update installment status
  UPDATE installments
     SET is_paid = true,
         paid_at = p_paid_date,
         paid_recorded_at = NOW(),
         payment_mode = 'ordinary',
         paid_date = p_paid_date,
         extra_interest_euro = 0,
         extra_penalty_euro = 0,
         late_days = GREATEST(0, (p_paid_date - due_date)),
         penalty_amount_cents = 0,
         interest_amount_cents = 0,
         paid_total_cents = (amount * 100)::bigint
   WHERE id = p_installment_id AND owner_uid = auth.uid();
END $$;

-- 4) Function: ravvedimento payment (manual total amount)
CREATE OR REPLACE FUNCTION mark_installment_paid_ravvedimento_new(
  p_installment_id bigint,
  p_paid_date date,
  p_total_paid numeric,
  p_interest numeric DEFAULT null,
  p_penalty numeric DEFAULT null
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_principal numeric;
  v_extra numeric;
  v_i numeric;
  v_p numeric;
BEGIN
  SELECT amount INTO v_principal FROM installments WHERE id = p_installment_id AND owner_uid = auth.uid() FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Installment not found or access denied';
  END IF;
  
  v_extra := GREATEST(p_total_paid - v_principal, 0);
  v_i := COALESCE(p_interest, v_extra);
  v_p := COALESCE(p_penalty, 0);

  -- Record payments in ledger
  INSERT INTO installment_payments (installment_id, paid_date, kind, amount)
  VALUES (p_installment_id, p_paid_date, 'principal', v_principal);

  IF v_i > 0 THEN
    INSERT INTO installment_payments (installment_id, paid_date, kind, amount)
    VALUES (p_installment_id, p_paid_date, 'interest', v_i);
  END IF;

  IF v_p > 0 THEN
    INSERT INTO installment_payments (installment_id, paid_date, kind, amount)
    VALUES (p_installment_id, p_paid_date, 'penalty', v_p);
  END IF;

  -- Update installment status
  UPDATE installments
     SET is_paid = true,
         paid_at = p_paid_date,
         paid_recorded_at = NOW(),
         payment_mode = 'ravvedimento',
         paid_date = p_paid_date,
         extra_interest_euro = v_i,
         extra_penalty_euro = v_p,
         late_days = GREATEST(0, (p_paid_date - due_date)),
         penalty_amount_cents = (v_p * 100)::bigint,
         interest_amount_cents = (v_i * 100)::bigint,
         paid_total_cents = (p_total_paid * 100)::bigint
   WHERE id = p_installment_id AND owner_uid = auth.uid();
END $$;

-- 5) Summary view that separates principal and extra amounts
CREATE OR REPLACE VIEW v_rateation_summary AS
SELECT
  r.id,
  SUM(i.amount) as importo_totale,
  SUM(CASE WHEN i.is_paid THEN i.amount ELSE 0 END) as importo_pagato_quota,
  SUM(COALESCE(i.extra_interest_euro,0) + COALESCE(i.extra_penalty_euro,0)) as extra_ravv_pagati,
  SUM(CASE WHEN NOT i.is_paid THEN i.amount ELSE 0 END) as totale_residuo,
  COUNT(*) as rate_totali,
  COUNT(*) FILTER (WHERE i.is_paid) as rate_pagate,
  COUNT(*) FILTER (WHERE NOT i.is_paid AND i.due_date < CURRENT_DATE) as rate_in_ritardo,
  COUNT(*) FILTER (WHERE i.payment_mode = 'ravvedimento') as rate_pagate_ravv
FROM rateations r
JOIN installments i ON i.rateation_id = r.id
GROUP BY r.id;