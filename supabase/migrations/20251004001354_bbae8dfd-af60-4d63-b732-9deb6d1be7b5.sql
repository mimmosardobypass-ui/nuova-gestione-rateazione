-- RPC get_residual_detail: restituisce dettaglio residui con filtri globali
CREATE OR REPLACE FUNCTION public.get_residual_detail(
  p_start_date date DEFAULT (date_trunc('year'::text, (CURRENT_DATE)::timestamp with time zone))::date,
  p_end_date date DEFAULT ((date_trunc('year'::text, (CURRENT_DATE)::timestamp with time zone) + '1 year -1 days'::interval))::date,
  p_type_labels text[] DEFAULT NULL::text[],
  p_statuses text[] DEFAULT NULL::text[],
  p_taxpayer_search text DEFAULT NULL::text,
  p_owner_only boolean DEFAULT true
)
RETURNS TABLE(
  id bigint,
  number text,
  taxpayer_name text,
  type_label text,
  status text,
  created_at timestamp with time zone,
  residual_amount_cents bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.number,
    r.taxpayer_name,
    vtl.type_label,
    r.status,
    r.created_at,
    r.residual_amount_cents
  FROM rateations r
  LEFT JOIN v_rateation_type_label vtl ON vtl.id = r.id
  WHERE 
    -- RLS: solo rateazioni dell'utente corrente
    (NOT p_owner_only OR r.owner_uid = auth.uid())
    -- Solo residui > 0
    AND r.residual_amount_cents > 0
    -- Filtro periodo (created_at)
    AND r.created_at::date BETWEEN p_start_date AND p_end_date
    -- Filtro tipologie
    AND (p_type_labels IS NULL OR vtl.type_label = ANY(p_type_labels))
    -- Filtro stati
    AND (p_statuses IS NULL OR r.status = ANY(p_statuses))
    -- Filtro contribuente (ricerca parziale case-insensitive)
    AND (p_taxpayer_search IS NULL OR r.taxpayer_name ILIKE '%' || p_taxpayer_search || '%')
  ORDER BY r.residual_amount_cents DESC, r.created_at DESC;
END;
$function$;