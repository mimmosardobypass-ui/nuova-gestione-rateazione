-- Server-side type safety: Accept TEXT[] parameters and cast safely with clear errors
-- This provides ultimate protection even if client validation fails

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

  -- Get owner of the PagoPA
  select owner_uid into v_owner_uid
  from rateations
  where id = v_pagopa_id and rateation_type = 'PagoPA';

  if not found then
    raise exception 'PagoPA non trovata o tipo non valido: %', v_pagopa_id;
  end if;

  -- Verify user owns this PagoPA
  if v_owner_uid != auth.uid() then
    raise exception 'Accesso negato alla PagoPA: %', v_pagopa_id;
  end if;

  -- Mark PagoPA as INTERROTTA (only if not already)
  update rateations
  set rateation_status = 'INTERROTTA'
  where id = v_pagopa_id
    and owner_uid = auth.uid()
    and rateation_status != 'INTERROTTA';

  -- Loop through RQ IDs and create links
  foreach v_idtext in array p_rq_ids loop
    -- Cast RQ ID safely with clear error message
    begin
      v_rq_id := v_idtext::bigint;
    exception when others then
      raise exception 'ID RQ non numerico: %', v_idtext;
    end;

    -- Verify user owns this RQ
    if not exists (
      select 1 from rateations
      where id = v_rq_id
        and owner_uid = auth.uid()
        and rateation_type = 'RiamQuater'
    ) then
      raise exception 'RQ non trovata o accesso negato: %', v_rq_id;
    end if;

    -- Insert link (avoid duplicates: only if no active link exists)
    insert into riam_quater_links (pagopa_id, riam_quater_id, note)
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