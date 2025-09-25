-- 1.1 Riconoscimento motivi RQ (helper function)
CREATE OR REPLACE FUNCTION public.is_rq_reason(txt text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(txt,'') ILIKE '%rq%'
      OR COALESCE(txt,'') ILIKE '%riammissione%'
      OR COALESCE(txt,'') ILIKE '%quater%';
$$;

-- 1.2 Quota allocabile della PagoPA (robusta con fallback)
CREATE OR REPLACE FUNCTION public.pagopa_quota_info(p_pagopa_id bigint)
RETURNS TABLE(residual_cents bigint, allocated_cents bigint, allocatable_cents bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH p AS (
    -- Usa preferibilmente la vista, fallback al campo residual_amount_cents
    SELECT COALESCE(v.residual_cents, r.residual_amount_cents, 0)::bigint as residual_cents
    FROM rateations r
    LEFT JOIN v_pagopa_allocations v ON v.pagopa_id = r.id
    LEFT JOIN rateation_types rt ON rt.id = r.type_id
    WHERE r.id = p_pagopa_id 
      AND UPPER(COALESCE(rt.name, '')) = 'PAGOPA'
      AND r.owner_uid = auth.uid()
  ),
  a AS (
    SELECT COALESCE(SUM(allocated_residual_cents), 0)::bigint as allocated_cents
    FROM riam_quater_links l
    JOIN rateations r ON r.id = l.pagopa_id
    WHERE l.pagopa_id = p_pagopa_id
      AND r.owner_uid = auth.uid()
  )
  SELECT p.residual_cents,
         a.allocated_cents,
         GREATEST(p.residual_cents - a.allocated_cents, 0)::bigint as allocatable_cents
  FROM p, a;
$$;

-- 1.3 RQ disponibili per la PagoPA selezionata (filtrate server-side)
CREATE OR REPLACE FUNCTION public.get_rq_available_for_pagopa(p_pagopa_id bigint)
RETURNS TABLE(id bigint, number text, taxpayer_name text, quater_total_due_cents bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH sel AS (
    SELECT r.owner_uid
    FROM rateations r
    LEFT JOIN rateation_types rt ON rt.id = r.type_id
    WHERE r.id = p_pagopa_id 
      AND UPPER(COALESCE(rt.name, '')) = 'PAGOPA'
      AND r.owner_uid = auth.uid()
  )
  SELECT r.id,
         r.number::text,
         r.taxpayer_name,
         -- Se non c'è campo in centesimi, deriva da total_amount
         COALESCE(r.quater_total_due_cents,
                  ROUND(COALESCE(r.total_amount, 0) * 100))::bigint as quater_total_due_cents
  FROM rateations r, sel
  WHERE COALESCE(r.is_quater, false) = true
    AND COALESCE(r.status, 'attiva') <> 'INTERROTTA'
    AND r.owner_uid = sel.owner_uid                -- Scoping per owner
    AND NOT EXISTS (                               -- Non già agganciata
      SELECT 1
      FROM riam_quater_links l
      WHERE l.riam_quater_id = r.id
    )
  ORDER BY NULLIF(regexp_replace(r.number, '\D', '', 'g'), '')::numeric NULLS LAST, r.number;
$$;