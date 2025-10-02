-- Corregge l'ambiguità di riam_quater_id nella funzione RPC
-- Usa RETURN QUERY SELECT invece di assegnazioni ambigue

drop function if exists public.pagopa_migrate_attach_rq(text, text[], text);

create or replace function public.pagopa_migrate_attach_rq(
  p_pagopa_id text,
  p_rq_ids text[],
  p_note text default null
)
returns table (link_id bigint, riam_quater_id bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pagopa_id bigint;
  v_rq_id bigint;
  v_idtext text;
  v_owner_uid uuid;
  v_new_link_id bigint;
  v_is_pagopa boolean;
  v_is_rq boolean;
begin
  -- Cast PagoPA ID safely with clear error message
  begin
    v_pagopa_id := p_pagopa_id::bigint;
  exception when others then
    raise exception 'ID PagoPA non numerico: %', p_pagopa_id;
  end;

  -- Validate RQ IDs array
  if p_rq_ids is null or array_length(p_rq_ids, 1) is null then
    raise exception 'Nessuna RQ selezionata';
  end if;

  -- Get owner and verify PagoPA type
  select r.owner_uid, 
         exists(
           select 1 from rateation_types rt 
           where rt.id = r.type_id 
           and upper(coalesce(rt.name, '')) like '%PAGOPA%'
         )
  into v_owner_uid, v_is_pagopa
  from rateations r
  where r.id = v_pagopa_id;

  if not found then
    raise exception 'PagoPA non trovata: %', v_pagopa_id;
  end if;

  if not v_is_pagopa then
    raise exception 'La rateazione % non è di tipo PagoPA', v_pagopa_id;
  end if;

  -- Verify user owns this PagoPA
  if v_owner_uid != auth.uid() then
    raise exception 'Accesso negato alla PagoPA: %', v_pagopa_id;
  end if;

  -- Mark PagoPA as INTERROTTA
  update rateations
  set status = 'INTERROTTA',
      interruption_reason = coalesce(interruption_reason, 'RQ_LINK'),
      interrupted_at = coalesce(interrupted_at, current_date)
  where id = v_pagopa_id
    and owner_uid = auth.uid()
    and status != 'INTERROTTA';

  -- Loop through RQ IDs and create links
  foreach v_idtext in array p_rq_ids loop
    -- Cast RQ ID safely
    begin
      v_rq_id := v_idtext::bigint;
    exception when others then
      raise exception 'ID RQ non numerico: %', v_idtext;
    end;

    -- Verify RQ: controlla tipo O flag is_quater
    select r.owner_uid = auth.uid() 
           and (
             r.is_quater = true 
             or exists(
               select 1 from rateation_types rt 
               where rt.id = r.type_id 
               and upper(coalesce(rt.name, '')) like '%QUATER%'
             )
           )
    into v_is_rq
    from rateations r
    where r.id = v_rq_id;

    if not found or not v_is_rq then
      raise exception 'RQ non trovata o non è Riammissione Quater: %', v_rq_id;
    end if;

    -- Insert link (avoid duplicates)
    insert into riam_quater_links (pagopa_id, riam_quater_id, reason)
    select v_pagopa_id, v_rq_id, p_note
    where not exists (
      select 1 from riam_quater_links l
      where l.pagopa_id = v_pagopa_id
        and l.riam_quater_id = v_rq_id
        and l.unlinked_at is null
    )
    returning id into v_new_link_id;

    -- Return the link info using RETURN QUERY SELECT (evita ambiguità)
    if v_new_link_id is not null then
      return query select v_new_link_id, v_rq_id;
    end if;
  end loop;

  return;
end;
$$;