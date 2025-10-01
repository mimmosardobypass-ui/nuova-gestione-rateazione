-- Fix RPC get_rq_available_for_pagopa: filtra per owner_uid della PagoPA specifica
-- Risolve il problema delle RQ vuote nella select di migrazione
create or replace function public.get_rq_available_for_pagopa(p_pagopa_id bigint)
returns table (
  id bigint,
  number text,
  taxpayer_name text,
  quater_total_due_cents bigint
)
language sql stable security definer set search_path=public as $$
  with src as (
    select
      r.id, r.number, r.taxpayer_name, r.quater_total_due_cents, r.owner_uid
    from rateations r
    join rateation_types rt on rt.id = r.type_id
    where upper(rt.name) in ('RIAM.QUATER','RIAMMISSIONE QUATER')
      and not exists (
        select 1 from riam_quater_links l
        where l.riam_quater_id = r.id and l.unlinked_at is null
      )
  )
  select s.id, s.number, s.taxpayer_name, s.quater_total_due_cents
  from src s
  where s.owner_uid = (select owner_uid from rateations where id = p_pagopa_id)
  order by s.id desc;
$$;