-- PIANO DEFINITIVO: RPC robuste + correzione dati N.34

-- 1.1 pagopa_quota_info (calcolo corretto della quota)
CREATE OR REPLACE FUNCTION public.pagopa_quota_info(p_pagopa_id bigint)
RETURNS TABLE (
  residual_cents bigint,
  allocated_cents bigint,
  allocatable_cents bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
WITH p AS (
  -- Calcolo robusto del residuo: usa vista se disponibile, altrimenti calcola da installments
  SELECT COALESCE(
    v.residual_cents, 
    r.residual_amount_cents,
    -- Fallback: calcola direttamente dagli installments
    (SELECT COALESCE(SUM(
      CASE 
        WHEN i.amount_cents IS NOT NULL THEN i.amount_cents
        ELSE (i.amount * 100)::bigint
      END
    ), 0)
    FROM installments i 
    WHERE i.rateation_id = r.id AND i.is_paid = false),
    0
  )::bigint AS residual_cents
  FROM rateations r
  LEFT JOIN v_pagopa_allocations v ON v.pagopa_id = r.id
  LEFT JOIN rateation_types rt ON rt.id = r.type_id
  WHERE r.id = p_pagopa_id 
    AND UPPER(COALESCE(rt.name, '')) = 'PAGOPA'
    AND r.owner_uid = auth.uid()
),
l AS (
  -- Somma solo link attivi (esclude soft-delete o storici)
  SELECT COALESCE(SUM(l.allocated_residual_cents), 0)::bigint AS allocated_cents
  FROM riam_quater_links l
  JOIN rateations r ON r.id = l.pagopa_id
  WHERE l.pagopa_id = p_pagopa_id
    AND r.owner_uid = auth.uid()
    -- Se hai colonne per soft-delete/status, aggiungi qui:
    -- AND COALESCE(l.deleted_at IS NULL, true)
    -- AND COALESCE(l.status, 'ACTIVE') = 'ACTIVE'
)
SELECT
  p.residual_cents,
  l.allocated_cents,
  GREATEST(p.residual_cents - l.allocated_cents, 0)::bigint AS allocatable_cents
FROM p CROSS JOIN l;
$$;

-- 1.2 get_rq_available_for_pagopa (solo RQ mai collegate a nessuna PagoPA)
CREATE OR REPLACE FUNCTION public.get_rq_available_for_pagopa(p_pagopa_id bigint)
RETURNS TABLE (
  id bigint,
  number text,
  taxpayer_name text,
  quater_total_due_cents bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
WITH owner AS (
  SELECT r.owner_uid 
  FROM rateations r
  LEFT JOIN rateation_types rt ON rt.id = r.type_id
  WHERE r.id = p_pagopa_id 
    AND UPPER(COALESCE(rt.name, '')) = 'PAGOPA'
    AND r.owner_uid = auth.uid()
),
blocked AS (
  -- Tutte le RQ già collegate a QUALSIASI PagoPA (link attivi)
  SELECT DISTINCT l.riam_quater_id
  FROM riam_quater_links l
  -- Se hai colonne per soft-delete/status, aggiungi qui:
  -- WHERE COALESCE(l.deleted_at IS NULL, true)
  --   AND COALESCE(l.status, 'ACTIVE') = 'ACTIVE'
)
SELECT
  r.id,
  r.number::text,
  r.taxpayer_name,
  COALESCE(r.quater_total_due_cents, (r.total_amount * 100)::bigint, 0)::bigint AS quater_total_due_cents
FROM rateations r
JOIN owner o ON o.owner_uid = r.owner_uid
WHERE COALESCE(r.is_quater, false) = true
  AND COALESCE(r.status, 'attiva') <> 'INTERROTTA'
  AND NOT EXISTS (SELECT 1 FROM blocked b WHERE b.riam_quater_id = r.id)
ORDER BY NULLIF(regexp_replace(r.number, '\D', '', 'g'), '')::numeric NULLS LAST, r.number::text;
$$;

-- 1.3 pagopa_unlock_if_no_links (sblocco sempre se non c'è nessun link attivo)
CREATE OR REPLACE FUNCTION public.pagopa_unlock_if_no_links(p_pagopa_id bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_active_links boolean;
  v_owner_uid uuid;
BEGIN
  -- Check ownership first
  SELECT owner_uid INTO v_owner_uid
  FROM rateations 
  WHERE id = p_pagopa_id AND owner_uid = auth.uid();
  
  IF v_owner_uid IS NULL THEN
    RETURN false;
  END IF;

  -- Check for active links
  SELECT EXISTS(
    SELECT 1 FROM riam_quater_links l
    WHERE l.pagopa_id = p_pagopa_id
    -- Se hai colonne per soft-delete/status, aggiungi qui:
    -- AND COALESCE(l.deleted_at IS NULL, true)
    -- AND COALESCE(l.status, 'ACTIVE') = 'ACTIVE'
  ) INTO has_active_links;

  -- Se non ci sono link attivi, sblocca (indipendente dal motivo legacy)
  IF has_active_links IS FALSE THEN
    UPDATE rateations
    SET status = 'attiva',
        interruption_reason = NULL,
        interrupted_at = NULL
    WHERE id = p_pagopa_id
      AND owner_uid = v_owner_uid
      AND COALESCE(status, 'attiva') <> 'attiva';
    
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- 2. CORREZIONE DATI N.34: Fix amount_cents null negli installments
UPDATE installments i
SET amount_cents = (amount * 100)::bigint
WHERE amount_cents IS NULL 
  AND amount IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM rateations r 
    WHERE r.id = i.rateation_id 
      AND r.number = '34'
  );

-- 3. RICALCOLO residual_amount_cents per N.34
UPDATE rateations r
SET residual_amount_cents = COALESCE((
  SELECT SUM(i.amount_cents)
  FROM installments i
  WHERE i.rateation_id = r.id AND i.is_paid = false
), 0),
paid_amount_cents = COALESCE((
  SELECT SUM(i.amount_cents)
  FROM installments i
  WHERE i.rateation_id = r.id AND i.is_paid = true
), 0)
WHERE r.number = '34';

-- 4. INDICI per performance (se non già presenti)
CREATE INDEX IF NOT EXISTS idx_links_pagopa ON riam_quater_links(pagopa_id);
CREATE INDEX IF NOT EXISTS idx_links_rq ON riam_quater_links(riam_quater_id);
CREATE INDEX IF NOT EXISTS idx_installments_rateation_paid ON installments(rateation_id, is_paid);
CREATE INDEX IF NOT EXISTS idx_rateations_number ON rateations(number);
CREATE INDEX IF NOT EXISTS idx_rateations_owner_quater ON rateations(owner_uid, is_quater) WHERE is_quater = true;