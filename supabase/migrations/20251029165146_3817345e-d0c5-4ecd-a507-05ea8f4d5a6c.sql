-- =====================================================
-- FASE 1: RPC Function per Evoluzione Debito Residuo
-- =====================================================
-- Restituisce importi mensili aggregati per tipo (F24, PagoPa, Quater, Riam.Quater)
-- con zero-fill garantito per tutti i mesi e tipi nel range richiesto

CREATE OR REPLACE FUNCTION public.residual_evolution_by_type(
  p_year_from INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER,
  p_year_to INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER,
  p_pay_filter TEXT DEFAULT 'unpaid'
)
RETURNS TABLE (
  year INTEGER,
  month INTEGER,
  type_label TEXT,
  amount_cents BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH all_combinations AS (
    -- Genera tutte le combinazioni anno × mese × tipo
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
    -- Query base su installments con normalizzazione tipo
    SELECT
      EXTRACT(YEAR FROM i.due_date)::INTEGER AS year,
      EXTRACT(MONTH FROM i.due_date)::INTEGER AS month,
      CASE
        -- F24 ha priorità assoluta
        WHEN r.is_f24 = TRUE THEN 'F24'
        
        -- Riam.Quater: rateazioni interrotte da una Quater
        WHEN r.interrupted_by_rateation_id IS NOT NULL 
          AND EXISTS (
            SELECT 1 FROM rateations rq 
            WHERE rq.id = r.interrupted_by_rateation_id 
            AND rq.is_quater = TRUE
          ) THEN 'Riam. Quater'
        
        -- Rottamazione Quater: is_quater = TRUE
        WHEN r.is_quater = TRUE THEN 'Rottamazione Quater'
        
        -- PagoPa: tipo PAGOPA (non F24, non Quater)
        WHEN EXISTS (
          SELECT 1 FROM rateation_types rt 
          WHERE rt.id = r.type_id 
          AND UPPER(COALESCE(rt.name, '')) LIKE '%PAGOPA%'
        ) THEN 'PagoPa'
        
        ELSE 'Altro'
      END AS type_label,
      
      -- Calcolo importo in base al filtro
      CASE
        WHEN p_pay_filter = 'unpaid' THEN 
          i.amount_cents - COALESCE(i.paid_total_cents, 0)
        WHEN p_pay_filter = 'paid' THEN 
          COALESCE(i.paid_total_cents, 0)
        ELSE -- 'all'
          i.amount_cents
      END AS amount_cents
    FROM installments i
    INNER JOIN rateations r ON r.id = i.rateation_id
    WHERE i.owner_uid = auth.uid()
      AND r.owner_uid = auth.uid()
      AND EXTRACT(YEAR FROM i.due_date) BETWEEN p_year_from AND p_year_to
      -- Escludi rateazioni cancellate
      AND COALESCE(r.is_deleted, FALSE) = FALSE
  ),
  aggregated AS (
    -- Aggrega per anno/mese/tipo
    SELECT
      year,
      month,
      type_label,
      COALESCE(SUM(amount_cents), 0) AS amount_cents
    FROM base_data
    GROUP BY year, month, type_label
  )
  -- Zero-fill: left join per garantire tutte le combinazioni
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
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.residual_evolution_by_type(INTEGER, INTEGER, TEXT) TO authenticated;