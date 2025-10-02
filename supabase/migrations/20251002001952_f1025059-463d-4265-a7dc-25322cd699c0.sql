-- FASE 1: Elimina funzione duplicata (quella con parametri bigint)
drop function if exists public.pagopa_migrate_attach_rq(bigint, bigint[], text);

-- FASE 2: Ricrea la funzione con parametri TEXT e logica corretta
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
  v_link_id bigint;
  v_is_pagopa boolean;
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

  -- Get owner and verify PagoPA type (CORRETTO: usa JOIN su rateation_types)
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

  -- Mark PagoPA as INTERROTTA (CORRETTO: usa campo 'status' non 'rateation_status')
  update rateations
  set status = 'INTERROTTA',
      interruption_reason = coalesce(interruption_reason, 'RQ_LINK'),
      interrupted_at = coalesce(interrupted_at, current_date)
  where id = v_pagopa_id
    and owner_uid = auth.uid()
    and status != 'INTERROTTA';

  -- Loop through RQ IDs and create links
  foreach v_idtext in array p_rq_ids loop
    -- Cast RQ ID safely with clear error message
    begin
      v_rq_id := v_idtext::bigint;
    exception when others then
      raise exception 'ID RQ non numerico: %', v_idtext;
    end;

    -- Verify user owns this RQ and is_quater (CORRETTO: usa campo is_quater)
    if not exists (
      select 1 from rateations
      where id = v_rq_id
        and owner_uid = auth.uid()
        and is_quater = true
    ) then
      raise exception 'RQ non trovata o non è Riammissione Quater: %', v_rq_id;
    end if;

    -- Insert link (avoid duplicates: only if no active link exists)
    insert into riam_quater_links (pagopa_id, riam_quater_id, reason)
    select v_pagopa_id, v_rq_id, p_note
    where not exists (
      select 1 from riam_quater_links
      where pagopa_id = v_pagopa_id
        and riam_quater_id = v_rq_id
        and unlinked_at is null
    )
    returning id into v_link_id;

    -- Return the link info (if created)
    if v_link_id is not null then
      link_id := v_link_id;
      riam_quater_id := v_rq_id;
      return next;
    end if;
  end loop;

  return;
end;
$$;