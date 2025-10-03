-- ============================================================================
-- FIX DOPPIO CONTEGGIO RISPARMIO PAGOPA
-- ============================================================================
-- Vista aggregata per calcolare correttamente risparmio PagoPA con più RQ
-- Risparmio = Residuo PagoPA - Somma(Totali RQ distinti)
-- ============================================================================

CREATE OR REPLACE VIEW v_pagopa_links_group AS
WITH links AS (
  -- Tutti i link attivi con snapshot e residuo corrente
  SELECT 
    l.pagopa_id, 
    l.riam_quater_id,
    l.pagopa_residual_at_link_cents,
    l.rq_total_at_link_cents,
    p.residual_amount_cents
  FROM riam_quater_links l
  JOIN rateations p ON p.id = l.pagopa_id
  WHERE l.unlinked_at IS NULL
),
residuo AS (
  -- Residuo PagoPA unico (dalla pratica corrente, fallback a snapshot)
  SELECT 
    pagopa_id,
    COALESCE(
      MAX(residual_amount_cents),
      MAX(pagopa_residual_at_link_cents),
      0
    ) AS residuo_pagopa_cents
  FROM links
  GROUP BY pagopa_id
),
rq_per_link AS (
  -- Totale per ogni RQ collegata (snapshot o calcolo da installments)
  SELECT
    pagopa_id,
    riam_quater_id,
    COALESCE(
      rq_total_at_link_cents,
      (SELECT COALESCE(SUM((i.amount * 100)::bigint), 0)
       FROM v_installments_status i
       WHERE i.rateation_id = l.riam_quater_id)
    ) AS rq_total_cents
  FROM riam_quater_links l
  WHERE l.unlinked_at IS NULL
),
rq_distinct AS (
  -- Anti-duplicati: 1 riga per RQ (MAX in caso di link multipli alla stessa RQ)
  SELECT 
    pagopa_id, 
    riam_quater_id, 
    MAX(rq_total_cents) AS rq_total_cents
  FROM rq_per_link
  GROUP BY pagopa_id, riam_quater_id
),
rq_sum AS (
  -- Somma totali RQ distinti per ogni PagoPA
  SELECT 
    pagopa_id, 
    SUM(rq_total_cents) AS totale_rq_collegati_cents
  FROM rq_distinct
  GROUP BY pagopa_id
)
SELECT
  r.pagopa_id,
  r.residuo_pagopa_cents,
  q.totale_rq_collegati_cents,
  GREATEST(r.residuo_pagopa_cents - q.totale_rq_collegati_cents, 0)::bigint
    AS risparmio_stimato_group_cents
FROM residuo r
JOIN rq_sum q USING (pagopa_id);

COMMENT ON VIEW v_pagopa_links_group IS 
'Vista aggregata per PagoPA con più RQ: calcola risparmio corretto = residuo - somma(RQ distinti)';
