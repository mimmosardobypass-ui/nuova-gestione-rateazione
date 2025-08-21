-- Patch definitiva "Saldo Decaduto"

-- 1) Trigger che fotografa lo snapshot anche in INSERT
CREATE OR REPLACE FUNCTION public.fn_capture_decadence_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- INSERT: piano creato già in stato 'decaduta'
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'decaduta' THEN
      NEW.decadence_at := COALESCE(NEW.decadence_at, NOW());
      NEW.residual_at_decadence_cents := COALESCE(
        NEW.residual_at_decadence_cents,
        NEW.residual_amount_cents,
        ROUND(COALESCE(NEW.residual_amount, 0) * 100)
      )::bigint;
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: transizione verso 'decaduta'
  IF TG_OP = 'UPDATE' THEN
    IF COALESCE(OLD.status, 'active') <> 'decaduta'
       AND NEW.status = 'decaduta' THEN
      NEW.decadence_at := COALESCE(NEW.decadence_at, NOW());
      NEW.residual_at_decadence_cents := COALESCE(
        NEW.residual_at_decadence_cents,
        NEW.residual_amount_cents,
        ROUND(COALESCE(NEW.residual_amount, 0) * 100)
      )::bigint;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_capture_decadence_snapshot ON public.rateations;

CREATE TRIGGER trg_capture_decadence_snapshot
BEFORE INSERT OR UPDATE ON public.rateations
FOR EACH ROW
EXECUTE FUNCTION public.fn_capture_decadence_snapshot();

-- 2) Backfill per i piani già decaduti senza snapshot
UPDATE public.rateations r
SET
  residual_at_decadence_cents = COALESCE(
    r.residual_at_decadence_cents,
    r.residual_amount_cents,
    ROUND(COALESCE(r.residual_amount, 0) * 100)
  )::bigint,
  decadence_at = COALESCE(r.decadence_at, NOW())
WHERE r.status = 'decaduta'
  AND (r.residual_at_decadence_cents IS NULL OR r.residual_at_decadence_cents = 0);

-- 3) Vista "Saldo Decaduto" che somma tutti i piani e non duplica i trasferimenti
CREATE OR REPLACE VIEW public.v_dashboard_decaduto AS
WITH r AS (
  SELECT
    id,
    COALESCE(
      residual_at_decadence_cents,
      residual_amount_cents,
      ROUND(COALESCE(residual_amount, 0) * 100)
    )::bigint AS snap_cents
  FROM public.rateations
  WHERE status = 'decaduta'
    AND COALESCE(is_f24, true) = true  -- limita agli F24 se serve
),
t AS (
  SELECT f24_id, SUM(amount_cents)::bigint AS transferred_cents
  FROM public.rateation_transfers
  GROUP BY f24_id
)
SELECT
  COALESCE(SUM(r.snap_cents), 0)::bigint                           AS gross_decayed_cents,
  COALESCE(SUM(t.transferred_cents), 0)::bigint                    AS transferred_cents,
  (COALESCE(SUM(r.snap_cents), 0) - COALESCE(SUM(t.transferred_cents), 0))::bigint AS net_to_transfer_cents
FROM r
LEFT JOIN t ON t.f24_id = r.id;

ALTER VIEW public.v_dashboard_decaduto SET (security_invoker = on);