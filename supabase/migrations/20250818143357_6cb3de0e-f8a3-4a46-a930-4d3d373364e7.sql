-- ========================
-- 1) Estende installments con campi ravvedimento
-- ========================
ALTER TABLE public.installments
  ADD COLUMN IF NOT EXISTS penalty_amount_cents     bigint,
  ADD COLUMN IF NOT EXISTS interest_amount_cents    bigint,
  ADD COLUMN IF NOT EXISTS paid_total_cents         bigint,
  ADD COLUMN IF NOT EXISTS penalty_rule_id          uuid,
  ADD COLUMN IF NOT EXISTS interest_breakdown       jsonb;

-- =========================================
-- 2) Tabelle di configurazione (RAVVEDIMENTO)
-- =========================================
CREATE TABLE IF NOT EXISTS public.legal_interest_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  valid_from date NOT NULL,
  valid_to   date NOT NULL,
  annual_rate_percent numeric(7,4) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.ravvedimento_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_default boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.ravvedimento_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.ravvedimento_profiles(id) ON DELETE CASCADE,
  min_days int NOT NULL,
  max_days int NOT NULL,
  mode text NOT NULL CHECK (mode IN ('per_day','fixed_percent')),
  per_day_percent numeric(7,4),
  fixed_percent  numeric(7,4),
  priority int NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_ravv_rules_profile ON public.ravvedimento_rules(profile_id);

-- ===================================================
-- 3) RPC: calcolo del ravvedimento (senza aggiornare)
-- ===================================================
CREATE OR REPLACE FUNCTION public.compute_ravvedimento(
  p_amount_cents bigint,
  p_due_date date,
  p_paid_at date,
  p_profile_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_days int;
  v_profile uuid;
  v_rule record;
  v_penalty_cents bigint := 0;
  v_interest_cents bigint := 0;
  v_total_cents bigint := 0;

  v_cursor date;
  v_next date;
  v_rate record;
  v_breakdown jsonb := '[]'::jsonb;
BEGIN
  IF p_paid_at <= p_due_date THEN
    RETURN jsonb_build_object(
      'late_days', 0,
      'penalty_amount_cents', 0,
      'interest_amount_cents', 0,
      'paid_total_cents', p_amount_cents,
      'penalty_rule_id', NULL,
      'interest_breakdown', '[]'::jsonb
    );
  END IF;

  v_days := (p_paid_at - p_due_date);

  -- profilo
  IF p_profile_id IS NOT NULL THEN
    v_profile := p_profile_id;
  ELSE
    SELECT id INTO v_profile FROM public.ravvedimento_profiles WHERE is_default = true LIMIT 1;
  END IF;

  -- regola sanzione
  SELECT *
    INTO v_rule
  FROM public.ravvedimento_rules
  WHERE profile_id = v_profile
    AND v_days BETWEEN min_days AND max_days
  ORDER BY priority ASC, min_days ASC
  LIMIT 1;

  IF FOUND THEN
    IF v_rule.mode = 'per_day' THEN
      v_penalty_cents := round( p_amount_cents * ( (v_rule.per_day_percent/100.0) * v_days ) )::bigint;
    ELSE
      v_penalty_cents := round( p_amount_cents * ( v_rule.fixed_percent/100.0 ) )::bigint;
    END IF;
  END IF;

  -- interessi pro-rata tra periodi di tasso
  v_cursor := p_due_date;
  WHILE v_cursor < p_paid_at LOOP
    SELECT *
      INTO v_rate
    FROM public.legal_interest_rates
    WHERE v_cursor BETWEEN valid_from AND valid_to
    ORDER BY valid_from DESC
    LIMIT 1;

    IF NOT FOUND THEN
      v_breakdown := v_breakdown || jsonb_build_object(
        'from', v_cursor, 'to', p_paid_at, 'days', (p_paid_at - v_cursor),
        'annual_percent', 0.0, 'amount_cents', 0
      );
      EXIT;
    END IF;

    v_next := LEAST(p_paid_at, v_rate.valid_to + 1);

    v_interest_cents := v_interest_cents
      + round( p_amount_cents * (v_rate.annual_rate_percent/100.0) * ( (v_next - v_cursor)::numeric / 365.0 ) )::bigint;

    v_breakdown := v_breakdown || jsonb_build_object(
      'from', v_cursor, 'to', v_next - 1, 'days', (v_next - v_cursor),
      'annual_percent', v_rate.annual_rate_percent,
      'amount_cents', round( p_amount_cents * (v_rate.annual_rate_percent/100.0) * ( (v_next - v_cursor)::numeric / 365.0 ))
    );

    v_cursor := v_next;
  END LOOP;

  v_total_cents := p_amount_cents + v_penalty_cents + v_interest_cents;

  RETURN jsonb_build_object(
    'late_days', v_days,
    'penalty_amount_cents', v_penalty_cents,
    'interest_amount_cents', v_interest_cents,
    'paid_total_cents', v_total_cents,
    'penalty_rule_id', COALESCE(v_rule.id, NULL),
    'interest_breakdown', v_breakdown
  );
END;
$$;

-- ===============================================================
-- 4) RPC: applica ravvedimento ad 1 rata (update atomico + ritorno)
-- ===============================================================
CREATE OR REPLACE FUNCTION public.apply_ravvedimento(
  p_installment_id bigint,
  p_paid_at date,
  p_profile_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inst record;
  v_calc jsonb;
BEGIN
  -- RLS: consenti update solo al proprietario
  SELECT * INTO v_inst FROM public.installments i
  WHERE i.id = p_installment_id
    AND i.owner_uid = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Installment non trovato o accesso negato';
  END IF;

  v_calc := public.compute_ravvedimento(
    (v_inst.amount * 100)::bigint, v_inst.due_date, p_paid_at, p_profile_id
  );

  UPDATE public.installments
     SET is_paid = true,
         paid_at = p_paid_at,
         paid_recorded_at = NOW(),
         late_days = (v_calc ->> 'late_days')::int,
         penalty_amount_cents  = (v_calc ->> 'penalty_amount_cents')::bigint,
         interest_amount_cents = (v_calc ->> 'interest_amount_cents')::bigint,
         paid_total_cents      = (v_calc ->> 'paid_total_cents')::bigint,
         penalty_rule_id       = NULLIF((v_calc ->> 'penalty_rule_id'), '')::uuid,
         interest_breakdown    = (v_calc -> 'interest_breakdown')
   WHERE id = p_installment_id;

  RETURN v_calc;
END;
$$;

-- Permessi di esecuzione RPC
GRANT EXECUTE ON FUNCTION public.compute_ravvedimento(bigint,date,date,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_ravvedimento(bigint,date,uuid) TO authenticated;

-- Seed di esempio
INSERT INTO public.ravvedimento_profiles (name, is_default)
VALUES ('Default F24', true)
ON CONFLICT DO NOTHING;

-- regole (esempi)
WITH p AS (SELECT id FROM public.ravvedimento_profiles WHERE is_default LIMIT 1)
INSERT INTO public.ravvedimento_rules (profile_id, min_days, max_days, mode, per_day_percent, fixed_percent, priority)
SELECT id, 1, 14, 'per_day', 0.10, NULL, 1 FROM p
UNION ALL SELECT id, 15, 30, 'fixed_percent', NULL, 3.00, 2 FROM p
UNION ALL SELECT id, 31, 90, 'fixed_percent', NULL, 3.33, 3 FROM p
UNION ALL SELECT id, 91, 365, 'fixed_percent', NULL, 3.75, 4 FROM p
ON CONFLICT DO NOTHING;

-- tassi legali (esempi)
INSERT INTO public.legal_interest_rates (valid_from, valid_to, annual_rate_percent) VALUES
('2024-01-01','2024-12-31', 2.50),
('2025-01-01','2025-12-31', 2.00)
ON CONFLICT DO NOTHING;

-- RLS policies per configurazione (read-only)
ALTER TABLE public.ravvedimento_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ravvedimento_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_interest_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ro_profiles" ON public.ravvedimento_profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "ro_rules" ON public.ravvedimento_rules
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "ro_rates" ON public.legal_interest_rates
  FOR SELECT TO authenticated USING (true);