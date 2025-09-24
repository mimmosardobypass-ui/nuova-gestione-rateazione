-- 1) Add allocated_residual_cents column to riam_quater_links
ALTER TABLE riam_quater_links
  ADD COLUMN IF NOT EXISTS allocated_residual_cents BIGINT;

-- 2) Initialize existing links with their pagopa_residual_at_link_cents value
UPDATE riam_quater_links l
SET allocated_residual_cents = COALESCE(l.pagopa_residual_at_link_cents, 0)
WHERE allocated_residual_cents IS NULL;

-- 3) Remove unique constraint on pagopa_id if it exists (allow multiple links per PagoPA)
DROP INDEX IF EXISTS riam_quater_links_pagopa_id_key;

-- 4) Create view for PagoPA allocation tracking
CREATE OR REPLACE VIEW v_pagopa_allocations AS
SELECT
  r.id AS pagopa_id,
  r.owner_uid,
  r.number AS pagopa_number,
  r.taxpayer_name,
  r.residual_amount_cents AS residual_cents,
  COALESCE(SUM(l.allocated_residual_cents), 0) AS allocated_cents,
  (r.residual_amount_cents - COALESCE(SUM(l.allocated_residual_cents), 0)) AS allocatable_cents
FROM rateations r
LEFT JOIN riam_quater_links l ON l.pagopa_id = r.id
LEFT JOIN rateation_types rt ON rt.id = r.type_id
WHERE UPPER(COALESCE(rt.name, '')) = 'PAGOPA'
  AND r.status != 'INTERROTTA'
GROUP BY r.id, r.owner_uid, r.number, r.taxpayer_name, r.residual_amount_cents;

-- 5) Create view for migrable PagoPA (now includes partially linked ones with remaining quota)
CREATE OR REPLACE VIEW v_migrable_pagopa AS
SELECT 
  r.id,
  r.number,
  r.taxpayer_name,
  r.status,
  r.interrupted_by_rateation_id,
  r.total_amount,
  a.allocatable_cents
FROM rateations r
JOIN v_pagopa_allocations a ON a.pagopa_id = r.id
LEFT JOIN rateation_types rt ON rt.id = r.type_id
WHERE UPPER(COALESCE(rt.name, '')) = 'PAGOPA'
  AND r.status != 'INTERROTTA'
  AND r.interrupted_by_rateation_id IS NULL
  AND a.allocatable_cents > 0;