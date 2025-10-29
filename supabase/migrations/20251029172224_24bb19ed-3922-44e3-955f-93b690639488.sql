-- Fix residual_evolution_by_type filter logic
-- The previous logic was incorrect: it calculated unpaid as amount_cents - paid_total_cents for ALL installments
-- Correct logic: filter installments by is_paid BEFORE aggregation

DROP FUNCTION IF EXISTS public.residual_evolution_by_type(integer, integer, text);

CREATE OR REPLACE FUNCTION public.residual_evolution_by_type(
  p_year_from integer DEFAULT EXTRACT(year FROM CURRENT_DATE)::integer,
  p_year_to integer DEFAULT EXTRACT(year FROM CURRENT_DATE)::integer,
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
    -- Generate all combinations year × month × type
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
    -- Base query on installments with type normalization
    SELECT
      EXTRACT(YEAR FROM i.due_date)::INTEGER AS year,
      EXTRACT(MONTH FROM i.due_date)::INTEGER AS month,
      CASE
        -- F24 has absolute priority
        WHEN r.is_f24 = TRUE THEN 'F24'
        
        -- Riam.Quater: rateations interrupted by a Quater
        WHEN r.interrupted_by_rateation_id IS NOT NULL 
          AND EXISTS (
            SELECT 1 FROM rateations rq 
            WHERE rq.id = r.interrupted_by_rateation_id 
            AND rq.is_quater = TRUE
          ) THEN 'Riam. Quater'
        
        -- Rottamazione Quater: is_quater = TRUE
        WHEN r.is_quater = TRUE THEN 'Rottamazione Quater'
        
        -- PagoPa: type PAGOPA (not F24, not Quater)
        WHEN EXISTS (
          SELECT 1 FROM rateation_types rt 
          WHERE rt.id = r.type_id 
          AND UPPER(COALESCE(rt.name, '')) LIKE '%PAGOPA%'
        ) THEN 'PagoPa'
        
        ELSE 'Altro'
      END AS type_label,
      
      -- Always use the original amount_cents
      i.amount_cents
    FROM installments i
    INNER JOIN rateations r ON r.id = i.rateation_id
    WHERE EXTRACT(YEAR FROM i.due_date) BETWEEN p_year_from AND p_year_to
      -- Exclude deleted rateations
      AND COALESCE(r.is_deleted, FALSE) = FALSE
      -- FIXED: Filter by payment status BEFORE aggregation
      AND (
        (p_pay_filter = 'unpaid' AND i.is_paid = FALSE) OR
        (p_pay_filter = 'paid' AND i.is_paid = TRUE) OR
        (p_pay_filter = 'all')
      )
  ),
  aggregated AS (
    -- Aggregate by year/month/type with explicit table qualifiers
    SELECT
      base_data.year,
      base_data.month,
      base_data.type_label,
      COALESCE(SUM(base_data.amount_cents), 0) AS amount_cents
    FROM base_data
    GROUP BY base_data.year, base_data.month, base_data.type_label
  )
  -- Zero-fill: left join to guarantee all combinations
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