-- SOLUZIONE DEFINITIVA: Sblocco diretto di tutte le PagoPA senza link RQ attivi
-- Questa operazione identifica e sblocca automaticamente tutte le PagoPA interrotte per motivi RQ che non hanno più link

DO $$
DECLARE 
  _rec record;
  _total_unlocked integer := 0;
BEGIN
  -- Trova tutte le PagoPA interrotte per motivi RQ senza link attivi
  FOR _rec IN 
    SELECT r.id, r.number, r.status, r.interruption_reason,
           (SELECT COUNT(*) FROM riam_quater_links l WHERE l.pagopa_id = r.id) as link_count
    FROM rateations r
    JOIN rateation_types rt ON rt.id = r.type_id
    WHERE UPPER(COALESCE(rt.name, '')) = 'PAGOPA'
      AND r.status = 'INTERROTTA'
      AND (
        r.interruption_reason = 'RQ_LINK' OR 
        r.interruption_reason = 'Interrotta per Riammissione Quater' OR
        r.interruption_reason ILIKE '%riammissione%quater%' OR
        r.interruption_reason ILIKE '%rq%'
      )
  LOOP
    -- Verifica se ha link attivi
    IF _rec.link_count = 0 THEN
      -- Sblocca la PagoPA
      UPDATE rateations
         SET status = 'attiva',
             interruption_reason = NULL,
             interrupted_at = NULL,
             updated_at = NOW()
       WHERE id = _rec.id;
      
      _total_unlocked := _total_unlocked + 1;
      
      RAISE NOTICE 'UNLOCKED: PagoPA #% (ID: %) - was: % with reason: %', 
        _rec.number, _rec.id, _rec.status, COALESCE(_rec.interruption_reason, 'NULL');
    ELSE
      RAISE NOTICE 'SKIPPED: PagoPA #% (ID: %) still has % active links', 
        _rec.number, _rec.id, _rec.link_count;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'SUMMARY: Total PagoPA unlocked: %', _total_unlocked;
  
  -- Se nessuna è stata sbloccata, mostra tutte le PagoPA interrotte per debugging
  IF _total_unlocked = 0 THEN
    RAISE NOTICE 'DEBUG: No PagoPA were unlocked. Checking all interrupted PagoPA...';
    FOR _rec IN 
      SELECT r.id, r.number, r.status, r.interruption_reason,
             (SELECT COUNT(*) FROM riam_quater_links l WHERE l.pagopa_id = r.id) as link_count
      FROM rateations r
      JOIN rateation_types rt ON rt.id = r.type_id
      WHERE UPPER(COALESCE(rt.name, '')) = 'PAGOPA'
        AND r.status = 'INTERROTTA'
      ORDER BY r.number
    LOOP
      RAISE NOTICE 'Found interrupted PagoPA #% (ID: %) - reason: % - links: %', 
        _rec.number, _rec.id, COALESCE(_rec.interruption_reason, 'NULL'), _rec.link_count;
    END LOOP;
  END IF;
END $$;

-- Aggiorna anche la funzione pagopa_unlock_if_no_links per essere più aggressiva
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
  _current_status text;
BEGIN
  -- Verifica se ci sono link attivi (senza filtro owner_uid per debug)
  SELECT EXISTS(
    SELECT 1 
    FROM riam_quater_links 
    WHERE pagopa_id = p_pagopa_id
  ) INTO _has_links;

  -- Ottieni stato e motivo corrente (senza filtro owner_uid per debug)
  SELECT status, interruption_reason 
  INTO _current_status, _current_reason
  FROM rateations 
  WHERE id = p_pagopa_id;

  IF NOT _has_links AND _current_status = 'INTERROTTA' THEN
    -- Sblocca QUALSIASI PagoPA interrotta senza link (più aggressivo)
    UPDATE rateations
       SET status = 'attiva', 
           interruption_reason = NULL,
           interrupted_at = NULL,
           updated_at = NOW()
     WHERE id = p_pagopa_id
       AND status = 'INTERROTTA';
    
    GET DIAGNOSTICS _was_updated = ROW_COUNT;
    
    -- Log dettagliato
    RAISE NOTICE 'PagoPA % - Status: %, Reason: %, Links: %, Updated: %', 
      p_pagopa_id, _current_status, COALESCE(_current_reason, 'NULL'), _has_links, _was_updated;
    
    RETURN _was_updated > 0;
  END IF;
  
  RAISE NOTICE 'PagoPA % - No unlock needed. Status: %, Links: %', 
    p_pagopa_id, _current_status, _has_links;
  
  RETURN false;
END $function$;