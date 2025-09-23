-- Performance indexes per collegamenti PagoPA-RQ
CREATE INDEX IF NOT EXISTS idx_rqlinks_pagopa_id ON riam_quater_links(pagopa_id);
CREATE INDEX IF NOT EXISTS idx_rqlinks_created_at ON riam_quater_links(created_at DESC);