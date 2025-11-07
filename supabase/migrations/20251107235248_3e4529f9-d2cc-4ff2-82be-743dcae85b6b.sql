-- Add groupBy parameter to residual_evolution_by_type for date filtering flexibility
-- Supports both 'due' (by due_date) and 'paid' (by paid_date) grouping

CREATE OR REPLACE FUNCTION public.residual_evolution_by_type(
  p_year_from integer DEFAULT (EXTRACT(year FROM CURRENT_DATE))::integer, 
  p_year_to integer DEFAULT (EXTRACT(year FROM CURRENT_DATE))::integer, 
  p_pay_filter text DEFAULT 'unpaid'::text,
  p_group_by text DEFAULT 'due'::text
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
      CASE 
        WHEN p_group_by = 'paid' THEN EXTRACT(YEAR FROM COALESCE(i.paid_date, i.paid_at))::INTEGER
        ELSE EXTRACT(YEAR FROM i.due_date)::INTEGER
      END AS year,
      CASE 
        WHEN p_group_by = 'paid' THEN EXTRACT(MONTH FROM COALESCE(i.paid_date, i.paid_at))::INTEGER
        ELSE EXTRACT(MONTH FROM i.due_date)::INTEGER
      END AS month,
      CASE
        WHEN r.is_f24 = TRUE THEN 'F24'
        WHEN r.is_quater = TRUE 
          AND EXISTS (
            SELECT 1 FROM rateation_types rt 
            WHERE rt.id = r.type_id 
            AND UPPER(COALESCE(rt.name, '')) LIKE '%RIAM%'
          ) THEN 'Riam. Quater'
        WHEN r.is_quater = TRUE THEN 'Rottamazione Quater'
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
    WHERE 
      CASE 
        WHEN p_group_by = 'paid' THEN 
          EXTRACT(YEAR FROM COALESCE(i.paid_date, i.paid_at)) BETWEEN p_year_from AND p_year_to
        ELSE 
          EXTRACT(YEAR FROM i.due_date) BETWEEN p_year_from AND p_year_to
      END
      AND COALESCE(r.is_deleted, FALSE) = FALSE
      AND r.status != 'INTERROTTA'
      AND (
        (p_pay_filter = 'unpaid' AND i.is_paid = FALSE) OR
        (p_pay_filter = 'paid' AND i.is_paid = TRUE AND p_group_by = 'paid' AND COALESCE(i.paid_date, i.paid_at) IS NOT NULL) OR
        (p_pay_filter = 'paid' AND i.is_paid = TRUE AND p_group_by = 'due') OR
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