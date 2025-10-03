-- STEP 1: Backfill owner_uid su installments (RLS fix)
UPDATE public.installments i
SET owner_uid = r.owner_uid
FROM public.rateations r
WHERE i.rateation_id = r.id
  AND i.owner_uid IS NULL;

-- STEP 2: Patch v_pagopa_linked_rq con fallback RLS-safe
DROP VIEW IF EXISTS v_pagopa_linked_rq CASCADE;

CREATE VIEW v_pagopa_linked_rq AS
SELECT
  l.pagopa_id,
  p.number AS pagopa_number,
  COALESCE(l.pagopa_taxpayer_at_link, p.taxpayer_name) AS pagopa_taxpayer,
  l.riam_quater_id,
  rq.number AS rq_number,
  COALESCE(l.rq_taxpayer_at_link, rq.taxpayer_name) AS rq_taxpayer,
  l.created_at AS linked_at,
  l.reason AS note,

  -- Fallback RLS-safe per residuo PagoPA (conversione euro -> cents)
  COALESCE(
    l.pagopa_residual_at_link_cents,
    (SELECT COALESCE(SUM((i.amount * 100)::bigint), 0)
     FROM v_installments_status i
     WHERE i.rateation_id = l.pagopa_id
       AND i.is_paid = FALSE)
  ) AS residuo_pagopa_at_link_cents,

  -- Fallback RLS-safe per totale RQ (conversione euro -> cents)
  COALESCE(
    l.rq_total_at_link_cents,
    (SELECT COALESCE(SUM((i.amount * 100)::bigint), 0)
     FROM v_installments_status i
     WHERE i.rateation_id = l.riam_quater_id)
  ) AS totale_rq_at_link_cents,

  -- Risparmio = max(0, residuo - totale)
  GREATEST(
    COALESCE(
      l.pagopa_residual_at_link_cents,
      (SELECT COALESCE(SUM((i.amount * 100)::bigint), 0)
       FROM v_installments_status i
       WHERE i.rateation_id = l.pagopa_id AND i.is_paid = FALSE)
    ) -
    COALESCE(
      l.rq_total_at_link_cents,
      (SELECT COALESCE(SUM((i.amount * 100)::bigint), 0)
       FROM v_installments_status i
       WHERE i.rateation_id = l.riam_quater_id)
    ),
    0
  )::bigint AS risparmio_at_link_cents

FROM riam_quater_links l
JOIN rateations p  ON p.id = l.pagopa_id
JOIN rateations rq ON rq.id = l.riam_quater_id
WHERE l.unlinked_at IS NULL;

-- STEP 3A: Fix pagopa_link_rq_v2 per salvare snapshot al link
CREATE OR REPLACE FUNCTION public.pagopa_link_rq_v2(payload jsonb)
RETURNS TABLE(link_id uuid, riam_quater_id bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_pagopa_id bigint;
  v_note text := payload->>'note';
  v_rq_txt text;
  v_rq_id bigint;
  v_owner_uid uuid;
  v_is_pagopa boolean;
  v_is_rq boolean;
  v_new_link_id uuid;
  
  -- Snapshot variables
  v_pagopa_residuo_cents bigint;
  v_rq_totale_cents bigint;
  v_pagopa_taxpayer text;
  v_rq_taxpayer text;
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

  IF payload->'rq_ids' IS NULL OR jsonb_array_length(payload->'rq_ids') = 0 THEN
    RAISE EXCEPTION 'Nessuna RQ selezionata';
  END IF;

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

  UPDATE rateations
  SET status = 'INTERROTTA',
      interruption_reason = COALESCE(interruption_reason, 'RQ_LINK'),
      interrupted_at = COALESCE(interrupted_at, CURRENT_DATE)
  WHERE id = v_pagopa_id
    AND owner_uid = auth.uid()
    AND status != 'INTERROTTA';

  FOR v_rq_txt IN
    SELECT value
    FROM jsonb_array_elements_text(payload->'rq_ids')
  LOOP
    v_rq_txt := btrim(v_rq_txt);
    IF v_rq_txt = '' OR v_rq_txt !~ '^[0-9]+$' THEN
      RAISE EXCEPTION 'ID RQ non numerico: %', v_rq_txt;
    END IF;
    
    v_rq_id := v_rq_txt::bigint;

    SELECT r.owner_uid = auth.uid() 
           AND (
             r.is_quater = true 
             OR EXISTS(
               SELECT 1 FROM rateation_types rt 
               WHERE rt.id = r.type_id 
               AND UPPER(COALESCE(rt.name, '')) LIKE '%QUATER%'
             )
           )
    INTO v_is_rq
    FROM rateations r
    WHERE r.id = v_rq_id;

    IF NOT FOUND OR NOT v_is_rq THEN
      RAISE EXCEPTION 'RQ non trovata o non è Riammissione Quater: %', v_rq_id;
    END IF;

    -- CAPTURE SNAPSHOTS at link time
    SELECT COALESCE(SUM(i.amount_cents), 0)
    INTO v_pagopa_residuo_cents
    FROM installments i
    WHERE i.rateation_id = v_pagopa_id
      AND i.is_paid = FALSE;

    SELECT COALESCE(SUM(i.amount_cents), 0)
    INTO v_rq_totale_cents
    FROM installments i
    WHERE i.rateation_id = v_rq_id;

    SELECT r.taxpayer_name INTO v_pagopa_taxpayer
    FROM rateations r WHERE r.id = v_pagopa_id;

    SELECT r.taxpayer_name INTO v_rq_taxpayer
    FROM rateations r WHERE r.id = v_rq_id;

    -- Insert with snapshots
    INSERT INTO riam_quater_links(
      pagopa_id,
      riam_quater_id,
      reason,
      pagopa_residual_at_link_cents,
      rq_total_at_link_cents,
      pagopa_taxpayer_at_link,
      rq_taxpayer_at_link
    )
    SELECT 
      v_pagopa_id, 
      v_rq_id, 
      v_note,
      v_pagopa_residuo_cents,
      v_rq_totale_cents,
      v_pagopa_taxpayer,
      v_rq_taxpayer
    WHERE NOT EXISTS (
      SELECT 1 FROM riam_quater_links l
      WHERE l.pagopa_id = v_pagopa_id
        AND l.riam_quater_id = v_rq_id
        AND l.unlinked_at IS NULL
    )
    RETURNING id INTO v_new_link_id;

    IF v_new_link_id IS NOT NULL THEN
      RETURN QUERY SELECT v_new_link_id, v_rq_id;
    END IF;
  END LOOP;

  RETURN;
END;
$$;

-- STEP 3B: Backfill snapshot mancanti sui link esistenti
UPDATE riam_quater_links l
SET
  pagopa_residual_at_link_cents = COALESCE(
    l.pagopa_residual_at_link_cents,
    (SELECT COALESCE(SUM(i.amount_cents), 0)
     FROM installments i
     WHERE i.rateation_id = l.pagopa_id AND i.is_paid = FALSE)
  ),
  rq_total_at_link_cents = COALESCE(
    l.rq_total_at_link_cents,
    (SELECT COALESCE(SUM(i.amount_cents), 0)
     FROM installments i
     WHERE i.rateation_id = l.riam_quater_id)
  ),
  pagopa_taxpayer_at_link = COALESCE(
    l.pagopa_taxpayer_at_link,
    (SELECT r.taxpayer_name FROM rateations r WHERE r.id = l.pagopa_id)
  ),
  rq_taxpayer_at_link = COALESCE(
    l.rq_taxpayer_at_link,
    (SELECT r.taxpayer_name FROM rateations r WHERE r.id = l.riam_quater_id)
  )
WHERE
  l.pagopa_residual_at_link_cents IS NULL
  OR l.rq_total_at_link_cents IS NULL
  OR l.pagopa_taxpayer_at_link IS NULL
  OR l.rq_taxpayer_at_link IS NULL;