-- Fix classification logic: PagoPa interrupted should remain PagoPa
-- Riam.Quater should only identify true Riammissioni Quater (type contains RIAM + is_quater=TRUE)

-- 1. Fix RPC residual_evolution_by_type
CREATE OR REPLACE FUNCTION public.residual_evolution_by_type(
  p_year_from integer DEFAULT (EXTRACT(year FROM CURRENT_DATE))::integer, 
  p_year_to integer DEFAULT (EXTRACT(year FROM CURRENT_DATE))::integer, 
  p_pay_filter text DEFAULT 'unpaid'::text
)
RETURNS TABLE(year integer, month integer, type_label text, amount_cents bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH all_combinations AS (
    SELECT 
      y.year,
      m.month,
      t.type_label
    FROM generate_series(p_year_from, p_year_to) AS y(year)
    CROSS JOIN generate_series(1, 12) AS m(month)
    CROSS JOIN (
      VALUES 
        ('F24'),
        ('PagoPa'),
        ('Rottamazione Quater'),
        ('Riam. Quater')
    ) AS t(type_label)
  ),
  base_data AS (
    SELECT
      EXTRACT(YEAR FROM i.due_date)::INTEGER AS year,
      EXTRACT(MONTH FROM i.due_date)::INTEGER AS month,
      CASE
        -- F24 has absolute priority
        WHEN r.is_f24 = TRUE THEN 'F24'
        
        -- Riam.Quater: is_quater = TRUE AND type contains RIAM
        WHEN r.is_quater = TRUE 
          AND EXISTS (
            SELECT 1 FROM rateation_types rt 
            WHERE rt.id = r.type_id 
            AND UPPER(COALESCE(rt.name, '')) LIKE '%RIAM%'
          ) THEN 'Riam. Quater'
        
        -- Rottamazione Quater: is_quater = TRUE (without RIAM)
        WHEN r.is_quater = TRUE THEN 'Rottamazione Quater'
        
        -- PagoPa: type contains PAGOPA (even if interrupted)
        WHEN EXISTS (
          SELECT 1 FROM rateation_types rt 
          WHERE rt.id = r.type_id 
          AND UPPER(COALESCE(rt.name, '')) LIKE '%PAGOPA%'
        ) THEN 'PagoPa'
        
        ELSE 'Altro'
      END AS type_label,
      
      i.amount_cents
    FROM installments i
    INNER JOIN rateations r ON r.id = i.rateation_id
    WHERE EXTRACT(YEAR FROM i.due_date) BETWEEN p_year_from AND p_year_to
      AND COALESCE(r.is_deleted, FALSE) = FALSE
      AND (
        (p_pay_filter = 'unpaid' AND i.is_paid = FALSE) OR
        (p_pay_filter = 'paid' AND i.is_paid = TRUE) OR
        (p_pay_filter = 'all')
      )
  ),
  aggregated AS (
    SELECT
      base_data.year,
      base_data.month,
      base_data.type_label,
      COALESCE(SUM(base_data.amount_cents), 0) AS amount_cents
    FROM base_data
    GROUP BY base_data.year, base_data.month, base_data.type_label
  )
  SELECT
    ac.year,
    ac.month,
    ac.type_label,
    COALESCE(ag.amount_cents, 0)::BIGINT AS amount_cents
  FROM all_combinations ac
  LEFT JOIN aggregated ag 
    ON ac.year = ag.year 
    AND ac.month = ag.month 
    AND ac.type_label = ag.type_label
  WHERE ac.type_label IN ('F24', 'PagoPa', 'Rottamazione Quater', 'Riam. Quater')
  ORDER BY ac.year, ac.month, ac.type_label;
END;
$function$;

-- 2. Fix v_rateation_type_label view
CREATE OR REPLACE VIEW v_rateation_type_label AS
SELECT 
  r.id,
  r.owner_uid,
  r.type_id,
  rt.name AS tipo,
  CASE
    -- F24 ha priorità assoluta
    WHEN r.is_f24 = TRUE THEN 'F24'
    
    -- Riam. Quater: is_quater = TRUE AND tipo contiene RIAM
    WHEN r.is_quater = TRUE 
      AND EXISTS (
        SELECT 1 FROM rateation_types rt2 
        WHERE rt2.id = r.type_id 
        AND UPPER(COALESCE(rt2.name, '')) LIKE '%RIAM%'
      ) THEN 'Riam. Quater'
    
    -- Rottamazione Quater: is_quater = TRUE (senza RIAM)
    WHEN r.is_quater = TRUE THEN 'Rottamazione Quater'
    
    -- PagoPa: tipo contiene PAGOPA (anche se interrotta)
    WHEN EXISTS (
      SELECT 1 FROM rateation_types rt2 
      WHERE rt2.id = r.type_id 
      AND UPPER(COALESCE(rt2.name, '')) LIKE '%PAGOPA%'
    ) THEN 'PagoPa'
    
    ELSE 'Altro'
  END AS type_label,
  EXISTS (
    SELECT 1 FROM rateation_types rt2 
    WHERE rt2.id = r.type_id 
    AND UPPER(COALESCE(rt2.name, '')) LIKE '%PAGOPA%'
  ) AS is_pagopa
FROM rateations r
LEFT JOIN rateation_types rt ON rt.id = r.type_id
WHERE r.owner_uid = auth.uid();