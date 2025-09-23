-- PHASE 1: Add residual_at_interruption_cents field to rateations table
ALTER TABLE public.rateations 
ADD COLUMN IF NOT EXISTS residual_at_interruption_cents bigint DEFAULT 0;

-- PHASE 1: Create trigger to capture residual when status becomes INTERROTTA
CREATE OR REPLACE FUNCTION public.fn_capture_interruption_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only trigger when transitioning TO 'INTERROTTA' status
  IF TG_OP = 'UPDATE' AND 
     COALESCE(OLD.status, 'attiva') <> 'INTERROTTA' AND 
     NEW.status = 'INTERROTTA' THEN
    
    -- Capture current residual amount from unpaid installments
    SELECT COALESCE(SUM(i.amount_cents), 0)
    INTO NEW.residual_at_interruption_cents
    FROM installments i
    WHERE i.rateation_id = NEW.id AND i.is_paid = false;
    
    -- Set interruption timestamp
    NEW.interrupted_at := COALESCE(NEW.interrupted_at, CURRENT_DATE);
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trg_capture_interruption_snapshot ON public.rateations;

-- Create trigger on rateations table
CREATE TRIGGER trg_capture_interruption_snapshot
    BEFORE UPDATE ON public.rateations
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_capture_interruption_snapshot();

-- PHASE 2: Drop and recreate v_rateations_with_kpis to distinguish historical vs effective residual
DROP VIEW IF EXISTS v_rateations_with_kpis;

CREATE VIEW v_rateations_with_kpis AS
SELECT
  r.id,
  r.number,
  r.taxpayer_name,
  r.status,
  r.owner_uid,
  r.type_id,
  r.is_f24,
  r.interrupted_by_rateation_id,
  r.interrupted_at,
  r.created_at,
  r.updated_at,
  r.total_amount,
  
  -- Calculate tipo based on type name
  CASE 
    WHEN rt.name = 'F24' THEN 'F24'
    WHEN rt.name = 'PagoPA' THEN 'PagoPA' 
    WHEN rt.name = 'Riam.Quater' THEN 'Riam.Quater'
    ELSE 'Other'
  END AS tipo,
  
  -- is_pagopa flag
  (rt.name = 'PagoPA') AS is_pagopa,
  
  -- Total amount in cents
  (r.total_amount * 100)::bigint AS total_amount_cents,
  
  -- Paid amount (always from current installments)
  COALESCE(SUM(CASE WHEN i.is_paid = true THEN i.amount_cents ELSE 0 END), 0) AS paid_amount_cents,
  
  -- HISTORICAL/TECHNICAL residual: shows original debt amount even if interrupted
  CASE 
    WHEN r.status = 'INTERROTTA' AND r.residual_at_interruption_cents > 0
      THEN r.residual_at_interruption_cents
    ELSE COALESCE(SUM(CASE WHEN i.is_paid = false THEN i.amount_cents ELSE 0 END), 0)
  END AS residual_amount_cents,
  
  -- EFFECTIVE residual: zeroed for interrupted PagoPA, normal for others  
  CASE
    WHEN rt.name = 'PagoPA' AND r.status = 'INTERROTTA'
      THEN 0::bigint
    ELSE COALESCE(SUM(CASE WHEN i.is_paid = false THEN i.amount_cents ELSE 0 END), 0)
  END AS residual_effective_cents,
  
  -- Overdue amount (always from current installments)
  COALESCE(SUM(CASE WHEN i.is_paid = false AND i.due_date < CURRENT_DATE THEN i.amount_cents ELSE 0 END), 0) AS overdue_amount_cents,
  
  -- Installment counts
  COALESCE(COUNT(i.id), 0) AS rate_totali,
  COALESCE(COUNT(i.id) FILTER (WHERE i.is_paid = true), 0) AS rate_pagate,  
  COALESCE(COUNT(i.id) FILTER (WHERE i.is_paid = false AND i.due_date < CURRENT_DATE), 0) AS rate_in_ritardo,
  
  -- PagoPA specific KPIs
  CASE WHEN rt.name = 'PagoPA' THEN
    COALESCE(SUM(CASE WHEN i.due_date = CURRENT_DATE THEN i.amount_cents ELSE 0 END), 0)
  ELSE 0 END AS due_today_cents,
  
  CASE WHEN rt.name = 'PagoPA' THEN
    COALESCE(COUNT(i.id) FILTER (WHERE i.due_date = CURRENT_DATE AND i.is_paid = false), 0)
  ELSE 0 END AS unpaid_due_today,
  
  CASE WHEN rt.name = 'PagoPA' THEN  
    COALESCE(COUNT(i.id) FILTER (WHERE i.due_date < CURRENT_DATE AND i.is_paid = false), 0)
  ELSE 0 END AS unpaid_overdue_today,
  
  -- PagoPA risk calculation
  CASE WHEN rt.name = 'PagoPA' THEN
    CASE 
      WHEN COALESCE(COUNT(i.id) FILTER (WHERE i.due_date < CURRENT_DATE AND i.is_paid = false), 0) >= 5 
        THEN 5
      ELSE GREATEST(0, 5 - COALESCE(COUNT(i.id) FILTER (WHERE i.due_date < CURRENT_DATE AND i.is_paid = false), 0))
    END
  ELSE NULL END AS max_skips_effective,
  
  CASE WHEN rt.name = 'PagoPA' THEN
    GREATEST(0, 5 - COALESCE(COUNT(i.id) FILTER (WHERE i.due_date < CURRENT_DATE AND i.is_paid = false), 0))
  ELSE NULL END AS skip_remaining,
  
  CASE WHEN rt.name = 'PagoPA' THEN
    (COALESCE(COUNT(i.id) FILTER (WHERE i.due_date < CURRENT_DATE AND i.is_paid = false), 0) >= 5)
  ELSE false END AS at_risk_decadence,
  
  -- Debt migration info
  COALESCE(COUNT(rd.debt_id), 0) AS debts_total,
  COALESCE(COUNT(rd.debt_id) FILTER (WHERE rd.status = 'migrated_out'), 0) AS debts_migrated,
  
  -- RQ target IDs for migrated debts  
  ARRAY_AGG(DISTINCT rd.target_rateation_id) FILTER (WHERE rd.target_rateation_id IS NOT NULL) AS rq_target_ids,
  
  -- Debt numbers arrays
  ARRAY_AGG(DISTINCT d.number) FILTER (WHERE rd.status = 'migrated_out' AND d.number IS NOT NULL) AS migrated_debt_numbers,
  ARRAY_AGG(DISTINCT d.number) FILTER (WHERE rd.status = 'active' AND d.number IS NOT NULL) AS remaining_debt_numbers,
  
  -- Migration status
  CASE 
    WHEN COUNT(rd.debt_id) = 0 THEN NULL
    WHEN COUNT(rd.debt_id) FILTER (WHERE rd.status = 'migrated_out') = 0 THEN 'no_migrations'
    WHEN COUNT(rd.debt_id) FILTER (WHERE rd.status = 'active') = 0 THEN 'fully_migrated' 
    ELSE 'partial_migration'
  END AS rq_migration_status,
  
  -- Exclusion flag for interrupted PagoPA
  (rt.name = 'PagoPA' AND r.status = 'INTERROTTA') AS excluded_from_stats

FROM rateations r
LEFT JOIN rateation_types rt ON rt.id = r.type_id  
LEFT JOIN installments i ON i.rateation_id = r.id
LEFT JOIN rateation_debts rd ON rd.rateation_id = r.id
LEFT JOIN debts d ON d.id = rd.debt_id
GROUP BY 
  r.id, r.number, r.taxpayer_name, r.status, r.owner_uid, r.type_id, r.is_f24,
  r.interrupted_by_rateation_id, r.interrupted_at, r.created_at, r.updated_at, 
  r.total_amount, r.residual_at_interruption_cents, rt.name;

-- PHASE 3: Estimate and update historical residual for existing interrupted N.36 PagoPa
-- Based on the RQ link data, we can estimate the original PagoPA residual
UPDATE public.rateations 
SET residual_at_interruption_cents = (
  SELECT COALESCE(rql.pagopa_residual_at_link_cents, 0)
  FROM riam_quater_links rql  
  WHERE rql.pagopa_id = rateations.id
  LIMIT 1
)
WHERE status = 'INTERROTTA' 
  AND residual_at_interruption_cents = 0
  AND EXISTS (
    SELECT 1 FROM rateation_types rt 
    WHERE rt.id = rateations.type_id AND rt.name = 'PagoPA'
  );