-- Update v_scadenze view to include rateation_status from rateations table
CREATE OR REPLACE VIEW v_scadenze AS
SELECT 
  i.id,
  i.rateation_id,
  i.seq,
  i.due_date,
  i.amount,
  i.is_paid,
  i.paid_at,
  r.number as rateation_number,
  r.taxpayer_name,
  rt.name as type_name,
  rt.id as type_id,
  r.status as rateation_status,
  DATE_TRUNC('month', i.due_date)::date as due_month,
  DATE_TRUNC('week', i.due_date)::date as due_week,
  
  -- Calculate bucket based on due_date and payment status
  CASE 
    WHEN i.is_paid THEN 'Pagata'
    WHEN i.due_date < CURRENT_DATE THEN 'In ritardo'
    WHEN i.due_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'Entro 7 giorni'
    WHEN i.due_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'Entro 30 giorni'
    ELSE 'Futuro'
  END as bucket,
  
  -- Calculate aging band for overdue items
  CASE 
    WHEN i.is_paid OR i.due_date >= CURRENT_DATE THEN NULL
    WHEN CURRENT_DATE - i.due_date BETWEEN 1 AND 7 THEN '1–7'
    WHEN CURRENT_DATE - i.due_date BETWEEN 8 AND 30 THEN '8–30'
    WHEN CURRENT_DATE - i.due_date BETWEEN 31 AND 60 THEN '31–60'
    WHEN CURRENT_DATE - i.due_date > 60 THEN '>60'
    ELSE NULL
  END as aging_band,
  
  -- Days overdue (0 if not overdue)
  GREATEST(0, CURRENT_DATE - i.due_date) as days_overdue,
  
  i.owner_uid
FROM installments i
JOIN rateations r ON r.id = i.rateation_id  
JOIN rateation_types rt ON rt.id = r.type_id
WHERE i.owner_uid = auth.uid() AND r.owner_uid = auth.uid();

-- Create RPC function for deadlines counts with payFilter support
CREATE OR REPLACE FUNCTION deadlines_counts(
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL,
  p_type_ids bigint[] DEFAULT NULL,
  p_bucket text DEFAULT NULL,
  p_search text DEFAULT NULL
) 
RETURNS TABLE(
  paid_count bigint,
  unpaid_count bigint,
  total_count bigint
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE is_paid = true) as paid_count,
    COUNT(*) FILTER (WHERE is_paid = false AND COALESCE(rateation_status, '') != 'decaduta') as unpaid_count,
    COUNT(*) as total_count
  FROM v_scadenze
  WHERE 
    (p_start_date IS NULL OR due_date >= p_start_date)
    AND (p_end_date IS NULL OR due_date <= p_end_date)
    AND (p_type_ids IS NULL OR type_id = ANY(p_type_ids))
    AND (p_bucket IS NULL OR p_bucket = 'Tutte' OR bucket = p_bucket)
    AND (p_search IS NULL OR 
         rateation_number ILIKE '%' || p_search || '%' OR 
         COALESCE(taxpayer_name, '') ILIKE '%' || p_search || '%');
END;
$$;