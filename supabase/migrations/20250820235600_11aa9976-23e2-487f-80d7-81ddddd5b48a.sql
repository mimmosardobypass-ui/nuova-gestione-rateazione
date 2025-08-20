-- 1. Backfill per i piani già decaduti ma senza snapshot
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

-- 2. Trigger che fotografa lo snapshot quando un piano entra in "decaduta"
CREATE OR REPLACE FUNCTION public.fn_capture_decadence_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  -- Scatta solo quando si entra in stato 'decaduta'
  IF (TG_OP = 'UPDATE') THEN
    IF (COALESCE(OLD.status, 'active') <> 'decaduta'
        AND NEW.status = 'decaduta') THEN
      NEW.decadence_at := COALESCE(NEW.decadence_at, NOW());
      NEW.residual_at_decadence_cents := COALESCE(
        NEW.residual_at_decadence_cents,
        NEW.residual_amount_cents,
        ROUND(COALESCE(NEW.residual_amount, 0) * 100)
      )::bigint;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_capture_decadence_snapshot ON public.rateations;
CREATE TRIGGER trg_capture_decadence_snapshot
  BEFORE UPDATE ON public.rateations
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_capture_decadence_snapshot();

-- 3. Vista "Saldo Decaduto" aggiornata che usa sempre lo snapshot
CREATE OR REPLACE VIEW public.v_dashboard_decaduto AS
SELECT
  COALESCE(SUM(r.residual_at_decadence_cents), 0)::bigint AS gross_decayed_cents,
  COALESCE(SUM(r.transferred_amount * 100), 0)::bigint AS transferred_cents,
  (COALESCE(SUM(r.residual_at_decadence_cents), 0)
   - COALESCE(SUM(r.transferred_amount * 100), 0))::bigint AS net_to_transfer_cents
FROM public.rateations r
WHERE r.status = 'decaduta'
  AND COALESCE(r.is_f24, false) = true;

-- Imposta security_invoker per rispettare RLS
ALTER VIEW public.v_dashboard_decaduto SET (security_invoker = on);