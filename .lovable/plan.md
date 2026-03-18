

## Fix: PagoPA detail view not showing Quinquies (R5) links

### Problem
The `PagopaLinks` component only queries `v_pagopa_linked_rq` (Riam.Quater links). It has no awareness of `quinquies_links`. After migrating N.43 PagoPA to N.1Quinquies, the link is stored in `quinquies_links` but never displayed.

### Solution

#### 1. API: Add `getR5LinksForPagopa()` in `links.ts`
Query `quinquies_links` table directly (no view needed) filtering by `pagopa_id` and `unlinked_at IS NULL`. Also join to `rateations` to get the R5 number. Define a `QuinquiesLinkRow` interface.

#### 2. Component: Update `PagopaLinks.tsx`
- Fetch both RQ links (existing) and R5 links (new) in parallel
- Rename the card title from "Collegamenti Riam.Quater" to "Collegamenti Rottamazione" (generic)
- Display R5 links in a separate section with "R5" badge, showing:
  - R5 number, date, taxpayer, totale R5, residuo PagoPA snapshot
- If both RQ and R5 links exist, show both sections
- Update the empty state message accordingly

#### 3. No DB changes needed
The `quinquies_links` table already has all snapshot columns (`pagopa_residual_at_link_cents`, `quinquies_total_at_link_cents`, taxpayers, `risparmio_at_link_cents`).

### Files to modify
- `src/features/rateations/api/links.ts` -- add `getR5LinksForPagopa()`
- `src/features/rateations/components/PagopaLinks.tsx` -- fetch and display R5 links alongside RQ links

