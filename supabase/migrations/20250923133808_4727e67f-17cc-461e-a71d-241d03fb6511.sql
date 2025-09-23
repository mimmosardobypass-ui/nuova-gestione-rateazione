-- 1. Aggiungi colonne snapshot alla tabella riam_quater_links
ALTER TABLE riam_quater_links
ADD COLUMN IF NOT EXISTS pagopa_residual_at_link_cents BIGINT,
ADD COLUMN IF NOT EXISTS rq_total_at_link_cents BIGINT,
ADD COLUMN IF NOT EXISTS pagopa_taxpayer_at_link TEXT,
ADD COLUMN IF NOT EXISTS rq_taxpayer_at_link TEXT,
ADD COLUMN IF NOT EXISTS reason TEXT;

-- 2. Funzione trigger per valorizzare gli snapshot in INSERT
CREATE OR REPLACE FUNCTION set_rq_link_snapshots()
RETURNS trigger AS $$
BEGIN
  -- residual PagoPA al momento link (solo rate non pagate)
  SELECT COALESCE(SUM(i.amount_cents), 0)
    INTO NEW.pagopa_residual_at_link_cents
  FROM installments i
  WHERE i.rateation_id = NEW.pagopa_id AND i.is_paid = FALSE;

  -- totale RQ (tutti gli installments, pagati e non)
  SELECT COALESCE(SUM(i.amount_cents), 0)
    INTO NEW.rq_total_at_link_cents
  FROM installments i
  WHERE i.rateation_id = NEW.riam_quater_id;

  -- label contribuente "di allora" (stringhe più stabili per report)
  SELECT r.taxpayer_name
    INTO NEW.pagopa_taxpayer_at_link
  FROM rateations r WHERE r.id = NEW.pagopa_id;

  SELECT r.taxpayer_name
    INTO NEW.rq_taxpayer_at_link
  FROM rateations r WHERE r.id = NEW.riam_quater_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Crea trigger
DROP TRIGGER IF EXISTS trg_set_rq_link_snapshots ON riam_quater_links;
CREATE TRIGGER trg_set_rq_link_snapshots
BEFORE INSERT ON riam_quater_links
FOR EACH ROW EXECUTE FUNCTION set_rq_link_snapshots();

-- 4. Vista per collegamenti di una PagoPA
CREATE OR REPLACE VIEW v_pagopa_linked_rq AS
SELECT
  l.pagopa_id::text,
  p.number           AS pagopa_number,
  COALESCE(l.pagopa_taxpayer_at_link, p.taxpayer_name) AS pagopa_taxpayer,
  l.riam_quater_id::text,
  rq.number          AS rq_number,
  COALESCE(l.rq_taxpayer_at_link, rq.taxpayer_name)    AS rq_taxpayer,
  l.created_at       AS linked_at,
  l.reason           AS note,

  -- importi "fotografati" (fallback ai valori attuali se null)
  COALESCE(l.pagopa_residual_at_link_cents,
           (SELECT COALESCE(SUM(i.amount_cents), 0)
              FROM installments i
             WHERE i.rateation_id = l.pagopa_id AND i.is_paid = FALSE)
  ) AS residuo_pagopa_at_link_cents,

  COALESCE(l.rq_total_at_link_cents,
           (SELECT COALESCE(SUM(i.amount_cents), 0)
              FROM installments i
             WHERE i.rateation_id = l.riam_quater_id)
  ) AS totale_rq_at_link_cents,

  GREATEST(
    COALESCE(l.pagopa_residual_at_link_cents, 
             (SELECT COALESCE(SUM(i.amount_cents), 0)
                FROM installments i
               WHERE i.rateation_id = l.pagopa_id AND i.is_paid = FALSE), 0) -
    COALESCE(l.rq_total_at_link_cents,
             (SELECT COALESCE(SUM(i.amount_cents), 0)
                FROM installments i
               WHERE i.rateation_id = l.riam_quater_id), 0),
    0
  ) AS risparmio_at_link_cents

FROM riam_quater_links l
JOIN rateations p  ON p.id  = l.pagopa_id
JOIN rateations rq ON rq.id = l.riam_quater_id;