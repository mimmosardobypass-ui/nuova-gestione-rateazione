
-- RPC 1: Get available R5 (Quinquies) rateations for a PagoPA
CREATE OR REPLACE FUNCTION public.get_r5_available_for_pagopa(p_pagopa_id bigint)
RETURNS TABLE(id bigint, number text, taxpayer_name text, quater_total_due_cents bigint)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.id,
    r.number,
    r.taxpayer_name,
    r.quater_total_due_cents
  FROM rateations r
  WHERE
    r.owner_uid = auth.uid()
    AND r.is_quinquies = true
    AND r.status != 'decaduta'
    AND NOT EXISTS (
      SELECT 1
      FROM quinquies_links l
      WHERE l.quinquies_id = r.id
        AND l.unlinked_at IS NULL
    )
    AND r.id <> p_pagopa_id
  ORDER BY r.number;
$$;

-- RPC 2: Link PagoPA to R5 (Quinquies) atomically
CREATE OR REPLACE FUNCTION public.pagopa_link_r5_v2(payload jsonb)
RETURNS TABLE(link_id uuid, r5_id bigint)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pagopa_id bigint;
  v_note text := payload->>'note';
  v_r5_txt text;
  v_r5_id bigint;
  v_owner_uid uuid;
  v_is_pagopa boolean;
  v_is_r5 boolean;
  v_new_link_id uuid;
  v_pagopa_residuo_cents bigint;
  v_r5_totale_cents bigint;
  v_pagopa_taxpayer text;
  v_r5_taxpayer text;
  v_risparmio_cents bigint;
BEGIN
  -- Parse pagopa_id
  BEGIN
    IF jsonb_typeof(payload->'pagopa_id') = 'number' THEN
      v_pagopa_id := (payload->'pagopa_id')::numeric::bigint;
    ELSE
      IF coalesce(btrim(payload->>'pagopa_id'),'') = ''
         OR NOT (payload->>'pagopa_id') ~ '^[0-9]+$' THEN
        RAISE EXCEPTION 'ID PagoPA non numerico: %', payload->>'pagopa_id';
      END IF;
      v_pagopa_id := (payload->>'pagopa_id')::bigint;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'ID PagoPA non numerico: %', payload->>'pagopa_id';
  END;

  IF payload->'r5_ids' IS NULL OR jsonb_array_length(payload->'r5_ids') = 0 THEN
    RAISE EXCEPTION 'Nessuna R5 selezionata';
  END IF;

  -- Verify PagoPA ownership and type
  SELECT r.owner_uid,
         EXISTS(
           SELECT 1 FROM rateation_types rt
           WHERE rt.id = r.type_id
           AND UPPER(COALESCE(rt.name, '')) LIKE '%PAGOPA%'
         )
  INTO v_owner_uid, v_is_pagopa
  FROM rateations r
  WHERE r.id = v_pagopa_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PagoPA non trovata: %', v_pagopa_id;
  END IF;
  IF NOT v_is_pagopa THEN
    RAISE EXCEPTION 'La rateazione % non è di tipo PagoPA', v_pagopa_id;
  END IF;
  IF v_owner_uid != auth.uid() THEN
    RAISE EXCEPTION 'Accesso negato alla PagoPA: %', v_pagopa_id;
  END IF;

  -- Set PagoPA as INTERROTTA
  UPDATE rateations
  SET status = 'INTERROTTA',
      interruption_reason = COALESCE(interruption_reason, 'R5_LINK'),
      interrupted_at = COALESCE(interrupted_at, CURRENT_DATE)
  WHERE id = v_pagopa_id
    AND owner_uid = auth.uid()
    AND status != 'INTERROTTA';

  -- Loop through R5 IDs
  FOR v_r5_txt IN
    SELECT value FROM jsonb_array_elements_text(payload->'r5_ids')
  LOOP
    v_r5_txt := btrim(v_r5_txt);
    IF v_r5_txt = '' OR v_r5_txt !~ '^[0-9]+$' THEN
      RAISE EXCEPTION 'ID R5 non numerico: %', v_r5_txt;
    END IF;
    v_r5_id := v_r5_txt::bigint;

    -- Verify R5 ownership and type
    SELECT r.owner_uid = auth.uid()
           AND (
             r.is_quinquies = true
             OR EXISTS(
               SELECT 1 FROM rateation_types rt
               WHERE rt.id = r.type_id
               AND UPPER(COALESCE(rt.name, '')) LIKE '%QUINQUIES%'
             )
           )
    INTO v_is_r5
    FROM rateations r
    WHERE r.id = v_r5_id;

    IF NOT FOUND OR NOT v_is_r5 THEN
      RAISE EXCEPTION 'R5 non trovata o non è Rottamazione Quinquies: %', v_r5_id;
    END IF;

    -- Capture snapshots
    SELECT COALESCE(SUM(i.amount_cents), 0)
    INTO v_pagopa_residuo_cents
    FROM installments i
    WHERE i.rateation_id = v_pagopa_id AND i.is_paid = FALSE;

    SELECT COALESCE(SUM(i.amount_cents), 0)
    INTO v_r5_totale_cents
    FROM installments i
    WHERE i.rateation_id = v_r5_id;

    SELECT r.taxpayer_name INTO v_pagopa_taxpayer
    FROM rateations r WHERE r.id = v_pagopa_id;

    SELECT r.taxpayer_name INTO v_r5_taxpayer
    FROM rateations r WHERE r.id = v_r5_id;

    -- Calculate saving
    v_risparmio_cents := GREATEST(0, v_pagopa_residuo_cents - v_r5_totale_cents);

    -- Insert link with snapshots
    INSERT INTO quinquies_links(
      pagopa_id,
      quinquies_id,
      reason,
      pagopa_residual_at_link_cents,
      quinquies_total_at_link_cents,
      pagopa_taxpayer_at_link,
      quinquies_taxpayer_at_link,
      risparmio_at_link_cents
    )
    SELECT
      v_pagopa_id,
      v_r5_id,
      v_note,
      v_pagopa_residuo_cents,
      v_r5_totale_cents,
      v_pagopa_taxpayer,
      v_r5_taxpayer,
      v_risparmio_cents
    WHERE NOT EXISTS (
      SELECT 1 FROM quinquies_links l
      WHERE l.pagopa_id = v_pagopa_id
        AND l.quinquies_id = v_r5_id
        AND l.unlinked_at IS NULL
    )
    RETURNING id INTO v_new_link_id;

    IF v_new_link_id IS NOT NULL THEN
      RETURN QUERY SELECT v_new_link_id, v_r5_id;
    END IF;
  END LOOP;

  RETURN;
END;
$$;
