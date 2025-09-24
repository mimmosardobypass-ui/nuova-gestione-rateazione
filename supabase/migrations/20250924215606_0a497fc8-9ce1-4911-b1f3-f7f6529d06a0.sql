-- Vista per aggregare quote allocate per ciascuna RQ dell'utente
CREATE OR REPLACE VIEW v_rq_allocations AS
SELECT
  rq.id                                 AS rq_id,
  rq.owner_uid,
  COALESCE(SUM(l.allocated_residual_cents), 0) AS allocated_residual_cents,
  COALESCE(rq.quater_total_due_cents, 0) AS quater_total_due_cents
FROM rateations rq
LEFT JOIN riam_quater_links l ON l.riam_quater_id = rq.id
WHERE rq.is_quater = true
GROUP BY rq.id, rq.owner_uid, rq.quater_total_due_cents;

-- Aggiorna vista saving per utente: calcolo preciso in centesimi per-RQ
CREATE OR REPLACE VIEW v_quater_saving_per_user AS
SELECT
  owner_uid,
  COALESCE(SUM(GREATEST(allocated_residual_cents - quater_total_due_cents, 0)), 0) / 100.0 AS saving_eur
FROM v_rq_allocations
WHERE owner_uid IS NOT NULL
GROUP BY owner_uid;