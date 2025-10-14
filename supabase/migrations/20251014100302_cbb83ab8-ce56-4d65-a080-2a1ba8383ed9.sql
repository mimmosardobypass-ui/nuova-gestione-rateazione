-- Fix v_quater_saving_per_user to use risparmio_at_link_cents from riam_quater_links
-- This correctly calculates RQ savings from active PagoPa-RQ links

DROP VIEW IF EXISTS v_quater_saving_per_user;

CREATE OR REPLACE VIEW v_quater_saving_per_user AS
SELECT
  r.owner_uid,
  COALESCE(SUM(l.risparmio_at_link_cents), 0) / 100.0 AS saving_eur
FROM riam_quater_links l
JOIN rateations r ON r.id = l.riam_quater_id
WHERE l.unlinked_at IS NULL  -- Solo link attivi
  AND COALESCE(r.is_deleted, false) = false  -- Escludi rateazioni cancellate
GROUP BY r.owner_uid;