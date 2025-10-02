-- FIX DEFINITIVO: Elimina ambiguità RPC e casting implicito
-- DROP tutte le versioni vecchie di pagopa_migrate_attach_rq
DROP FUNCTION IF EXISTS public.pagopa_migrate_attach_rq(bigint, bigint[], text);
DROP FUNCTION IF EXISTS public.pagopa_migrate_attach_rq(bigint, bigint[]);
DROP FUNCTION IF EXISTS public.pagopa_migrate_attach_rq(numeric, numeric[], text);
DROP FUNCTION IF EXISTS public.pagopa_migrate_attach_rq(text, bigint[], text);
DROP FUNCTION IF EXISTS public.pagopa_migrate_attach_rq(bigint, text[], text);
DROP FUNCTION IF EXISTS public.pagopa_migrate_attach_rq(text, text[], text);

-- CREATE nuova RPC con payload JSON (zero ambiguità, cast espliciti e sicuri)
CREATE OR REPLACE FUNCTION public.pagopa_link_rq_v2(payload jsonb)
RETURNS TABLE (link_id bigint, riam_quater_id bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pagopa_id bigint;
  v_note text := payload->>'note';
  v_rq_id bigint;
  v_owner_uid uuid;
  v_is_pagopa boolean;
  v_is_rq boolean;
  v_new_link_id bigint;
BEGIN
  -- Cast sicuro del pagopa_id
  BEGIN
    v_pagopa_id := (payload->>'pagopa_id')::bigint;
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

  -- Ciclo sugli ID RQ con cast protetto
  FOR v_rq_id IN
    SELECT (x.value)::text::bigint
    FROM jsonb_array_elements(payload->'rq_ids') AS x(value)
  LOOP
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

    -- Return link info se creato
    IF v_new_link_id IS NOT NULL THEN
      RETURN QUERY SELECT v_new_link_id, v_rq_id;
    END IF;
  END LOOP;

  RETURN;
END;
$$;