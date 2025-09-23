-- Create view for Quater saving calculation per user
-- Uses existing risparmio_at_link_cents from riam_quater_links table
CREATE OR REPLACE VIEW v_quater_saving_per_user AS
SELECT 
  r.owner_uid,
  COALESCE(SUM(l.risparmio_at_link_cents), 0) / 100.0 AS saving_eur
FROM riam_quater_links l
JOIN rateations r ON r.id = l.riam_quater_id
GROUP BY r.owner_uid;

-- Grant read permissions
GRANT SELECT ON v_quater_saving_per_user TO anon, authenticated;