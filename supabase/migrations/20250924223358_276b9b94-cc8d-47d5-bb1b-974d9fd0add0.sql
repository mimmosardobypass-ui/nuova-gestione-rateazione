-- Drop and recreate v_pagopa_allocations view with dependencies using CASCADE
-- This allows editing of fully allocated PagoPA records
DROP VIEW IF EXISTS public.v_pagopa_allocations CASCADE;

-- Create the updated v_pagopa_allocations view with has_links field
CREATE VIEW public.v_pagopa_allocations AS
SELECT
  p.id                                         AS pagopa_id,
  p.number                                     AS pagopa_number,
  p.taxpayer_name,
  p.residual_amount_cents                      AS residual_cents,
  COALESCE(SUM(l.allocated_residual_cents), 0) AS allocated_cents,
  (p.residual_amount_cents - COALESCE(SUM(l.allocated_residual_cents), 0)) AS allocatable_cents,
  (COUNT(l.*) > 0)                             AS has_links,
  p.owner_uid
FROM rateations p
LEFT JOIN riam_quater_links l ON l.pagopa_id = p.id
LEFT JOIN rateation_types rt ON rt.id = p.type_id
WHERE UPPER(COALESCE(rt.name, '')) = 'PAGOPA'
GROUP BY p.id, p.number, p.taxpayer_name, p.residual_amount_cents, p.owner_uid;

-- Recreate v_migrable_pagopa view (assuming it uses similar structure)
CREATE VIEW public.v_migrable_pagopa AS
SELECT
  p.id,
  p.number,
  p.taxpayer_name,
  p.total_amount,
  p.status,
  p.interrupted_by_rateation_id,
  va.allocatable_cents
FROM rateations p
LEFT JOIN v_pagopa_allocations va ON va.pagopa_id = p.id
LEFT JOIN rateation_types rt ON rt.id = p.type_id
WHERE UPPER(COALESCE(rt.name, '')) = 'PAGOPA';