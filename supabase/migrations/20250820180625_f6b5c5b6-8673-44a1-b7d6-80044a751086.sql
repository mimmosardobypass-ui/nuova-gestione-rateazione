-- Ensure safe search path
SET search_path TO public;

-- FASE 1: DIAGNOSTICA E CORREZIONE DATI INCONSISTENTI

-- 1A) Identifica e corregge installments con is_paid=true ma paid_at=NULL
UPDATE installments 
SET is_paid = false,
    paid_at = NULL,
    paid_date = NULL,
    payment_mode = NULL,
    paid_total_cents = 0,
    penalty_amount_cents = 0,
    interest_amount_cents = 0,
    extra_interest_euro = 0,
    extra_penalty_euro = 0,
    late_days = NULL,
    paid_recorded_at = NULL
WHERE is_paid = true 
  AND paid_at IS NULL;

-- 1B) Forza ricalcolo di tutti i campi aggregati per le rateazioni
-- Questo assicura coerenza tra tutti i calcoli
UPDATE rateations SET
  total_amount = COALESCE((
    SELECT SUM(amount)
    FROM installments i
    WHERE i.rateation_id = rateations.id
  ), 0),
  
  paid_amount_cents = COALESCE((
    SELECT SUM(i.amount_cents)
    FROM installments i
    WHERE i.rateation_id = rateations.id AND i.is_paid = true
  ), 0),
  
  residual_amount_cents = COALESCE((
    SELECT SUM(i.amount_cents)
    FROM installments i
    WHERE i.rateation_id = rateations.id AND i.is_paid = false
  ), 0),
  
  overdue_amount_cents = COALESCE((
    SELECT SUM(i.amount_cents)
    FROM installments i
    WHERE i.rateation_id = rateations.id 
    AND i.is_paid = false 
    AND i.due_date < CURRENT_DATE
  ), 0),

  -- Ricalcola anche residual_at_decadence_cents per le decadute
  residual_at_decadence_cents = CASE
    WHEN status = 'decaduta' THEN COALESCE((
      SELECT SUM(i.amount_cents)
      FROM installments i
      WHERE i.rateation_id = rateations.id AND i.is_paid = false
    ), 0)
    ELSE residual_at_decadence_cents
  END;

-- FASE 2: MIGLIORAMENTI TRIGGER E VALIDAZIONI

-- 2A) Migliora il trigger di normalizzazione per essere più robusto
CREATE OR REPLACE FUNCTION public.fn_normalize_paid_fields_enhanced()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Se installment NON è pagato, pulisci TUTTI i campi di pagamento
  IF NEW.is_paid = false THEN
    NEW.paid_at := NULL;
    NEW.paid_date := NULL;
    NEW.payment_mode := NULL;
    NEW.paid_total_cents := 0;
    NEW.penalty_amount_cents := 0;
    NEW.interest_amount_cents := 0;
    NEW.extra_interest_euro := 0;
    NEW.extra_penalty_euro := 0;
    NEW.late_days := NULL;
    NEW.paid_recorded_at := NULL;
    NEW.penalty_rule_id := NULL;
    NEW.interest_breakdown := NULL;
  ELSE
    -- Se è pagato ma manca paid_at, impostalo a oggi
    IF NEW.paid_at IS NULL THEN
      NEW.paid_at := CURRENT_DATE;
    END IF;
    -- Assicura che paid_total_cents sia almeno l'importo base
    IF NEW.paid_total_cents IS NULL OR NEW.paid_total_cents = 0 THEN
      NEW.paid_total_cents := (NEW.amount * 100)::bigint;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 2B) Sostituisci il vecchio trigger con quello migliorato
DROP TRIGGER IF EXISTS trg_normalize_paid_fields ON installments;
CREATE TRIGGER trg_normalize_paid_fields
  BEFORE INSERT OR UPDATE ON installments
  FOR EACH ROW
  EXECUTE FUNCTION fn_normalize_paid_fields_enhanced();

-- 2C) Migliora la funzione di cancellazione pagamento per essere più robusta
CREATE OR REPLACE FUNCTION public.installment_cancel_payment_enhanced(p_installment_id bigint, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_rateation_id bigint;
  v_owner_uid uuid;
BEGIN
  -- Security check e get rateation info
  SELECT i.rateation_id, i.owner_uid 
  INTO v_rateation_id, v_owner_uid
  FROM public.installments i
  WHERE i.id = p_installment_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Installment not found';
  END IF;
  
  IF v_owner_uid != auth.uid() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Pulisci TUTTI i campi di pagamento in modo atomico
  UPDATE public.installments
  SET is_paid = false,
      paid_at = NULL,
      paid_date = NULL,
      payment_mode = NULL,
      paid_total_cents = 0,
      penalty_amount_cents = 0,
      interest_amount_cents = 0,
      extra_interest_euro = 0,
      extra_penalty_euro = 0,
      late_days = NULL,
      paid_recorded_at = NULL,
      penalty_rule_id = NULL,
      interest_breakdown = NULL
  WHERE id = p_installment_id;

  -- SEMPRE forza il ricalcolo totali
  PERFORM rateations_recalc_totals(v_rateation_id);
  
  -- Log per debugging futuro
  RAISE NOTICE 'Payment cancelled for installment % of rateation %. Reason: %', 
    p_installment_id, v_rateation_id, COALESCE(p_reason, 'No reason provided');
END;
$function$;

-- FASE 3: FUNZIONI DI MONITORAGGIO E DIAGNOSTICA

-- 3A) Funzione per identificare inconsistenze
CREATE OR REPLACE FUNCTION public.fn_detect_payment_inconsistencies()
RETURNS TABLE(
  rateation_id bigint,
  installment_id bigint,
  issue_type text,
  details jsonb
)
LANGUAGE sql
SECURITY DEFINER
AS $function$
  -- Installments con is_paid=true ma paid_at=NULL
  SELECT 
    i.rateation_id,
    i.id as installment_id,
    'paid_without_date' as issue_type,
    jsonb_build_object(
      'is_paid', i.is_paid,
      'paid_at', i.paid_at,
      'amount', i.amount
    ) as details
  FROM installments i
  WHERE i.is_paid = true AND i.paid_at IS NULL
    AND i.owner_uid = auth.uid()

  UNION ALL

  -- Installments con paid_at ma is_paid=false
  SELECT 
    i.rateation_id,
    i.id as installment_id,
    'date_without_paid' as issue_type,
    jsonb_build_object(
      'is_paid', i.is_paid,
      'paid_at', i.paid_at,
      'amount', i.amount
    ) as details
  FROM installments i
  WHERE i.is_paid = false AND i.paid_at IS NOT NULL
    AND i.owner_uid = auth.uid()

  UNION ALL

  -- Rateazioni con totali non coerenti
  SELECT 
    r.id as rateation_id,
    NULL as installment_id,
    'totals_mismatch' as issue_type,
    jsonb_build_object(
      'calculated_residual', COALESCE((
        SELECT SUM(i.amount_cents)
        FROM installments i
        WHERE i.rateation_id = r.id AND i.is_paid = false
      ), 0),
      'stored_residual', r.residual_amount_cents,
      'calculated_paid', COALESCE((
        SELECT SUM(i.amount_cents)
        FROM installments i
        WHERE i.rateation_id = r.id AND i.is_paid = true
      ), 0),
      'stored_paid', r.paid_amount_cents
    ) as details
  FROM rateations r
  WHERE r.owner_uid = auth.uid()
    AND (
      r.residual_amount_cents != COALESCE((
        SELECT SUM(i.amount_cents)
        FROM installments i
        WHERE i.rateation_id = r.id AND i.is_paid = false
      ), 0)
      OR
      r.paid_amount_cents != COALESCE((
        SELECT SUM(i.amount_cents)
        FROM installments i
        WHERE i.rateation_id = r.id AND i.is_paid = true
      ), 0)
    );
$function$;

-- 3B) Funzione per forzare il riallineamento di una specifica rateazione
CREATE OR REPLACE FUNCTION public.fn_realign_rateation_totals(p_rateation_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_before jsonb;
  v_after jsonb;
BEGIN
  -- Check ownership
  IF NOT EXISTS(SELECT 1 FROM rateations WHERE id = p_rateation_id AND owner_uid = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Capture stato prima
  SELECT jsonb_build_object(
    'paid_amount_cents', paid_amount_cents,
    'residual_amount_cents', residual_amount_cents,
    'overdue_amount_cents', overdue_amount_cents
  ) INTO v_before
  FROM rateations WHERE id = p_rateation_id;

  -- Forza ricalcolo
  PERFORM recompute_rateation_caches(p_rateation_id);

  -- Capture stato dopo
  SELECT jsonb_build_object(
    'paid_amount_cents', paid_amount_cents,
    'residual_amount_cents', residual_amount_cents,
    'overdue_amount_cents', overdue_amount_cents
  ) INTO v_after
  FROM rateations WHERE id = p_rateation_id;

  RETURN jsonb_build_object(
    'rateation_id', p_rateation_id,
    'before', v_before,
    'after', v_after,
    'changed', v_before != v_after
  );
END;
$function$;