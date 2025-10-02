-- Hardening definitivo parsing pagopa_id in pagopa_link_rq_v2
-- Aggiunge discriminazione JSON number vs string numerica + validazione regex
-- Completa il fix già implementato per rq_ids

CREATE OR REPLACE FUNCTION public.pagopa_link_rq_v2(payload jsonb)
 RETURNS TABLE(link_id bigint, riam_quater_id bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pagopa_id bigint;
  v_note text := payload->>'note';
  v_rq_txt text;
  v_rq_id bigint;
  v_owner_uid uuid;
  v_is_pagopa boolean;
  v_is_rq boolean;
  v_new_link_id bigint;
BEGIN
  -- 🔒 PARSING ROBUSTO di pagopa_id: accetta JSON number o stringa numerica
  BEGIN
    IF jsonb_typeof(payload->'pagopa_id') = 'number' THEN
      v_pagopa_id := (payload->'pagopa_id')::numeric::bigint;
    ELSE
      -- Valida che sia una stringa numerica (solo cifre)
      IF coalesce(btrim(payload->>'pagopa_id'),'') = '' 
         OR NOT (payload->>'pagopa_id') ~ '^[0-9]+$' THEN
        RAISE EXCEPTION 'ID PagoPA non numerico: %', payload->>'pagopa_id';
      END IF;
      v_pagopa_id := (payload->>'pagopa_id')::bigint;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'ID PagoPA non numerico: %', payload->>'pagopa_id';
  END;

  -- Verifica array rq_ids
  IF payload->'rq_ids' IS NULL OR jsonb_array_length(payload->'rq_ids') = 0 THEN
    RAISE EXCEPTION 'Nessuna RQ selezionata';
  END IF;

  -- Verifica ownership e tipo PagoPA
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

  -- Imposta PagoPA a INTERROTTA
  UPDATE rateations
  SET status = 'INTERROTTA',
      interruption_reason = COALESCE(interruption_reason, 'RQ_LINK'),
      interrupted_at = COALESCE(interrupted_at, CURRENT_DATE)
  WHERE id = v_pagopa_id
    AND owner_uid = auth.uid()
    AND status != 'INTERROTTA';

  -- 🔒 PARSING ROBUSTO di rq_ids: jsonb_array_elements_text() + validazione regex
  FOR v_rq_txt IN
    SELECT value
    FROM jsonb_array_elements_text(payload->'rq_ids')
  LOOP
    v_rq_txt := btrim(v_rq_txt);
    IF v_rq_txt = '' OR v_rq_txt !~ '^[0-9]+$' THEN
      RAISE EXCEPTION 'ID RQ non numerico: %', v_rq_txt;
    END IF;
    
    v_rq_id := v_rq_txt::bigint;

    -- Verifica RQ: tipo Quater o flag is_quater
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

    -- Insert link (evita duplicati attivi)
    INSERT INTO riam_quater_links(pagopa_id, riam_quater_id, reason)
    SELECT v_pagopa_id, v_rq_id, v_note
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
$function$;