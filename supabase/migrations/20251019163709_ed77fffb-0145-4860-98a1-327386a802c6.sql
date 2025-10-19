-- Vista aggregata per costi F24→PagoPA per utente
-- Somma maggiorazione_allocata_cents da f24_pagopa_links
CREATE OR REPLACE VIEW v_f24_pagopa_cost_per_user AS
SELECT
  r.owner_uid,
  COALESCE(SUM(l.maggiorazione_allocata_cents), 0) / 100.0 AS cost_eur
FROM f24_pagopa_links l
JOIN rateations r ON r.id = l.f24_id
GROUP BY r.owner_uid;

-- Grant permissions
GRANT SELECT ON v_f24_pagopa_cost_per_user TO anon, authenticated;

-- Comment
COMMENT ON VIEW v_f24_pagopa_cost_per_user IS 'Aggregated F24→PagoPA extra cost per user from active links';