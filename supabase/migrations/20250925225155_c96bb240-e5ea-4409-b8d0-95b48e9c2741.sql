-- FASE 1: Aggiornare pagopa_unlock_if_no_links per gestire formati legacy e nuovi
CREATE OR REPLACE FUNCTION public.pagopa_unlock_if_no_links(p_pagopa_id bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE 
  _has_links boolean;
  _was_updated boolean := false;
  _current_reason text;
BEGIN
  -- Verifica se ci sono link attivi
  SELECT EXISTS(
    SELECT 1 
    FROM riam_quater_links 
    WHERE pagopa_id = p_pagopa_id
  ) INTO _has_links;

  IF NOT _has_links THEN
    -- Ottieni il motivo di interruzione corrente per logging
    SELECT interruption_reason INTO _current_reason
    FROM rateations 
    WHERE id = p_pagopa_id AND owner_uid = auth.uid();

    -- Sblocca se il motivo è correlato a RQ (formato legacy o nuovo)
    UPDATE rateations
       SET status = 'attiva', 
           interruption_reason = NULL,
           interrupted_at = NULL,
           updated_at = NOW()
     WHERE id = p_pagopa_id
       AND status = 'INTERROTTA'
       AND (
         interruption_reason = 'RQ_LINK' OR 
         interruption_reason = 'Interrotta per Riammissione Quater' OR
         interruption_reason ILIKE '%riammissione%quater%' OR
         interruption_reason ILIKE '%rq%link%'
       )
       AND owner_uid = auth.uid();
    
    GET DIAGNOSTICS _was_updated = ROW_COUNT;
    
    -- Log per debugging (visibile nei log Postgres)
    IF _was_updated > 0 THEN
      RAISE NOTICE 'PagoPA % unlocked. Previous reason: %', p_pagopa_id, COALESCE(_current_reason, 'NULL');
    END IF;
    
    RETURN _was_updated > 0;
  END IF;
  
  RETURN false;
END $function$;

-- FASE 2: Standardizzare pagopa_lock_for_rq per usare sempre 'RQ_LINK'
CREATE OR REPLACE FUNCTION public.pagopa_lock_for_rq(p_pagopa_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  UPDATE rateations
     SET status = 'INTERROTTA',
         interruption_reason = 'RQ_LINK',  -- Sempre formato standardizzato
         interrupted_at = CURRENT_DATE,
         updated_at = NOW()
   WHERE id = p_pagopa_id
     AND EXISTS (
       SELECT 1 FROM rateation_types rt 
       WHERE rt.id = rateations.type_id 
       AND UPPER(COALESCE(rt.name, '')) = 'PAGOPA'
     )
     AND owner_uid = auth.uid()
     AND (
       COALESCE(interruption_reason, 'RQ_LINK') IN ('RQ_LINK', 'Interrotta per Riammissione Quater') OR
       interruption_reason IS NULL
     ); -- Non sovrascrivere altri motivi di interruzione non correlati a RQ
END $function$;

-- FASE 3: Funzione di utilità per sanitizzazione legacy (opzionale, per manutenzione)
CREATE OR REPLACE FUNCTION public.sanitize_legacy_interruption_reasons()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  _updated_count integer := 0;
BEGIN
  -- Converti tutti i formati legacy a 'RQ_LINK' standardizzato
  UPDATE rateations
     SET interruption_reason = 'RQ_LINK',
         updated_at = NOW()
   WHERE status = 'INTERROTTA'
     AND (
       interruption_reason = 'Interrotta per Riammissione Quater' OR
       interruption_reason ILIKE '%riammissione%quater%' OR
       interruption_reason ILIKE '%rq%link%'
     )
     AND interruption_reason != 'RQ_LINK';
  
  GET DIAGNOSTICS _updated_count = ROW_COUNT;
  
  RAISE NOTICE 'Sanitized % legacy interruption reasons to RQ_LINK', _updated_count;
  RETURN _updated_count;
END $function$;

-- FASE 4: Test immediato - sblocca N.34 se non ha link attivi
-- Questa chiamata verrà eseguita automaticamente dopo la migrazione
DO $$
DECLARE 
  _test_result boolean;
  _pagopa_34_id bigint;
BEGIN
  -- Trova l'ID di N.34 (assumendo che il numero sia '34') - corretto con qualifica completa
  SELECT r.id INTO _pagopa_34_id 
  FROM rateations r
  JOIN rateation_types rt ON rt.id = r.type_id
  WHERE r.number = '34' 
    AND UPPER(COALESCE(rt.name, '')) = 'PAGOPA'
  LIMIT 1;
  
  IF _pagopa_34_id IS NOT NULL THEN
    -- Prova a sbloccare N.34
    SELECT public.pagopa_unlock_if_no_links(_pagopa_34_id) INTO _test_result;
    
    IF _test_result THEN
      RAISE NOTICE 'SUCCESS: N.34 (ID: %) has been unlocked!', _pagopa_34_id;
    ELSE
      RAISE NOTICE 'INFO: N.34 (ID: %) was not unlocked (may still have active links or different status)', _pagopa_34_id;
    END IF;
  ELSE
    RAISE NOTICE 'WARNING: Could not find PagoPA with number 34';
  END IF;
END $$;