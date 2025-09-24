-- Phase 1: DB Hardening - Trigger to prevent over-allocation
CREATE OR REPLACE FUNCTION trg_validate_pagopa_allocation()
RETURNS TRIGGER AS $$
DECLARE
  alloc_total BIGINT;
  residual BIGINT;
BEGIN
  -- Lock links for this PagoPA to avoid race conditions
  PERFORM 1 FROM riam_quater_links WHERE pagopa_id = NEW.pagopa_id FOR UPDATE;

  -- Sum existing allocations (excluding current row in UPDATE case)
  SELECT COALESCE(SUM(allocated_residual_cents), 0)
    INTO alloc_total
    FROM riam_quater_links
   WHERE pagopa_id = NEW.pagopa_id
     AND (TG_OP <> 'UPDATE' OR id <> NEW.id);

  -- Get current residual of the PagoPA
  SELECT residual_amount_cents
    INTO residual
    FROM rateations r
    JOIN rateation_types rt ON rt.id = r.type_id
   WHERE r.id = NEW.pagopa_id
     AND UPPER(COALESCE(rt.name, '')) = 'PAGOPA'
     AND r.status != 'INTERROTTA'
   FOR UPDATE;

  IF residual IS NULL THEN
    RAISE EXCEPTION 'PagoPA % not found or not valid for allocation', NEW.pagopa_id;
  END IF;

  IF NEW.allocated_residual_cents <= 0 THEN
    RAISE EXCEPTION 'allocated_residual_cents must be > 0';
  END IF;

  IF alloc_total + NEW.allocated_residual_cents > residual THEN
    RAISE EXCEPTION 
      'Allocation exceeds available residual for PagoPA %. Available: %, trying to allocate: %',
      NEW.pagopa_id,
      residual - alloc_total,
      NEW.allocated_residual_cents;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger
DROP TRIGGER IF EXISTS validate_pagopa_allocation_insupd ON riam_quater_links;
CREATE TRIGGER validate_pagopa_allocation_insupd
BEFORE INSERT OR UPDATE ON riam_quater_links
FOR EACH ROW EXECUTE FUNCTION trg_validate_pagopa_allocation();

-- Performance indices
CREATE INDEX IF NOT EXISTS idx_riam_quater_links_pagopa_id ON riam_quater_links(pagopa_id);
CREATE INDEX IF NOT EXISTS idx_riam_quater_links_rq_id ON riam_quater_links(riam_quater_id);

-- Phase 3: KPI Fix - Update v_quater_saving_per_user to use allocated quotes
CREATE OR REPLACE VIEW v_quater_saving_per_user AS
SELECT
  r.owner_uid,
  COALESCE(SUM(
    CASE 
      WHEN l.allocated_residual_cents > 0 AND rq.quater_total_due_cents > 0
      THEN GREATEST(0, l.allocated_residual_cents - rq.quater_total_due_cents)
      ELSE 0
    END
  ), 0) / 100.0 AS saving_eur
FROM riam_quater_links l
JOIN rateations r ON r.id = l.pagopa_id
JOIN rateations rq ON rq.id = l.riam_quater_id
WHERE r.owner_uid IS NOT NULL
GROUP BY r.owner_uid;