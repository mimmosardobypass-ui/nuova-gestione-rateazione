-- View 1: Contribuenti/Cartelle aggregate per RQ
CREATE OR REPLACE VIEW v_rq_contribuenti_aggregati AS
SELECT
  rq.id                          AS riam_quater_id,
  rq.number                      AS rq_number,
  rq.taxpayer_name               AS rq_taxpayer,
  COALESCE(
    string_agg(DISTINCT pagopa.taxpayer_name, ', ' ORDER BY pagopa.taxpayer_name),
    ''
  )                              AS linked_taxpayers
FROM rateations rq
JOIN rateation_types rt ON rt.id = rq.type_id AND rt.name = 'Riam.Quater'
LEFT JOIN riam_quater_links l ON l.riam_quater_id = rq.id
LEFT JOIN rateations pagopa ON pagopa.id = l.pagopa_id
LEFT JOIN rateation_types tp ON tp.id = pagopa.type_id AND tp.name = 'PagoPA'
GROUP BY rq.id, rq.number, rq.taxpayer_name;

-- View 2: Dettaglio risparmio per collegamento (RQ ↔ PagoPA)
CREATE OR REPLACE VIEW v_risparmio_riam_quater AS
WITH pagopa_unpaid AS (
  SELECT
    i.rateation_id AS pagopa_id,
    SUM(CASE WHEN NOT i.is_paid THEN i.amount ELSE 0 END) AS pagopa_residuo_unpaid,
    SUM(CASE WHEN     i.is_paid THEN i.amount ELSE 0 END) AS pagopa_pagato
  FROM installments i
  GROUP BY i.rateation_id
),
rq_totals AS (
  SELECT
    i.rateation_id AS riam_quater_id,
    SUM(i.amount) AS rq_totale
  FROM installments i
  GROUP BY i.rateation_id
),
rq_meta AS (
  SELECT r.id AS riam_quater_id, r.number AS rq_number, r.taxpayer_name AS rq_taxpayer
  FROM rateations r
  JOIN rateation_types t ON t.id = r.type_id AND t.name = 'Riam.Quater'
),
pagopa_meta AS (
  SELECT r.id AS pagopa_id, r.number AS pagopa_number, r.taxpayer_name AS pagopa_taxpayer
  FROM rateations r
  JOIN rateation_types t ON t.id = r.type_id AND t.name = 'PagoPA'
)
SELECT
  l.riam_quater_id,
  rq_meta.rq_number,
  rq_meta.rq_taxpayer,
  l.pagopa_id,
  pagopa_meta.pagopa_number,
  pagopa_meta.pagopa_taxpayer,
  COALESCE(pagopa_unpaid.pagopa_residuo_unpaid, 0) AS residuo_pagopa,
  COALESCE(rq_totals.rq_totale, 0)                 AS totale_rq,
  GREATEST(COALESCE(pagopa_unpaid.pagopa_residuo_unpaid,0) - COALESCE(rq_totals.rq_totale,0), 0) AS risparmio_stimato
FROM riam_quater_links l
LEFT JOIN pagopa_unpaid ON pagopa_unpaid.pagopa_id = l.pagopa_id
LEFT JOIN rq_totals     ON rq_totals.riam_quater_id = l.riam_quater_id
LEFT JOIN rq_meta       ON rq_meta.riam_quater_id = l.riam_quater_id
LEFT JOIN pagopa_meta   ON pagopa_meta.pagopa_id   = l.pagopa_id;

-- View 3: Aggregato per RQ (somma dei residui PagoPA vs totale RQ)
CREATE OR REPLACE VIEW v_risparmio_riam_quater_aggregato AS
SELECT
  riam_quater_id,
  MIN(rq_number) AS rq_number,
  MIN(rq_taxpayer) AS rq_taxpayer,
  SUM(residuo_pagopa) AS residuo_pagopa_tot,
  MAX(totale_rq)      AS totale_rq,
  GREATEST(SUM(residuo_pagopa) - MAX(totale_rq), 0) AS risparmio_stimato_tot
FROM v_risparmio_riam_quater
GROUP BY riam_quater_id;

-- Performance index (optional)
CREATE INDEX IF NOT EXISTS idx_installments_rateation_id ON installments(rateation_id);
CREATE INDEX IF NOT EXISTS idx_riam_quater_links_rq ON riam_quater_links(riam_quater_id);
CREATE INDEX IF NOT EXISTS idx_riam_quater_links_pagopa ON riam_quater_links(pagopa_id);