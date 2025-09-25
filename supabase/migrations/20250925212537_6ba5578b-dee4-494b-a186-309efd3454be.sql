-- RPC function: Returns available RQ plans for a specific PagoPA (excludes already linked ones)
create or replace function public.get_rq_available_for_pagopa(p_pagopa_id bigint)
returns table (
  id bigint,
  number text,
  taxpayer_name text,
  quater_total_due_cents bigint
)
language sql
stable
as $$
  select rq.id, rq.number, rq.taxpayer_name, rq.quater_total_due_cents
  from rateations rq
  where rq.is_quater is true
    and coalesce(rq.status, '') <> 'INTERROTTA'
    and rq.owner_uid = auth.uid()
    and not exists (
      select 1
      from riam_quater_links l
      where l.pagopa_id = p_pagopa_id
        and l.riam_quater_id = rq.id
    )
  order by rq.number;
$$;

-- Performance indices for riam_quater_links
create index if not exists idx_links_pagopa on riam_quater_links(pagopa_id);
create index if not exists idx_links_rq on riam_quater_links(riam_quater_id);