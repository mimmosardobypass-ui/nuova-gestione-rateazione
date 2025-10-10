# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## Added - 2025-01-09

### F24 ↔ PagoPA Linking System v1.0 (DB-only)
Implementato sistema di collegamento bidirezionale tra piani F24 e PagoPA con snapshot immutabili e maggiorazione automatica.

**Database**:
- Nuova tabella `f24_pagopa_links` con snapshot immutabili al momento del link
- 3 RPC atomiche (`link_f24_to_pagopa_atomic`, `unlink_f24_from_pagopa`, `get_pagopa_available_for_f24`)
- Trigger automatico `trg_restore_f24_on_link_delete` per ripristino F24 su unlink
- 4 nuove views per reporting e KPI:
  - `v_f24_pagopa_maggiorazione` - Report maggiorazioni con dati snapshot
  - `v_f24_linked_status` - Stato F24 con link attivi
  - `v_kpi_rateations_effective` - KPI residuo effettivo (esclude F24 interrotte per link)
  - `v_kpi_rateations_overdue_effective` - KPI overdue effettivo (esclude F24 interrotte per link)

**Features**:
- Calcolo automatico maggiorazione: `MAX(0, PagoPA_totale - F24_residuo)`
- Snapshot immutabili di F24 e PagoPA al momento del collegamento
- Ripristino automatico stato F24 da `INTERROTTA` ad `ATTIVA` su eliminazione link
- RLS policies complete per sicurezza multi-tenant
- SECURITY DEFINER su tutte le RPC per garantire atomicità e sicurezza

**Operations**:
- Script di deployment: `docs/ops/deploy_f24_pagopa.sh`
- Runbook operativo: `docs/ops/F24_PAGOPA_OPS_HANDOFF.md`
- 4 validation checks post-deploy automatici
- Feature flag: `VITE_FEATURE_F24_PAGOPA` (default: false)

**Migration**: `supabase/migrations/20250109_f24_pagopa_links.sql`

**Security Notes**:
- Tutti i grants limitati a `authenticated` role (NO `public`)
- RLS policies verificano ownership su entrambe le rateazioni (F24 e PagoPA)
- SECURITY DEFINER su RPC per prevenire SQL injection e garantire transazioni atomiche

**Breaking Changes**: Nessuna (solo aggiunta)

**Acceptance Criteria**:
1. ✅ Tabella con 4 RLS policies e constraint unique per F24
2. ✅ 3 RPC atomiche con grants solo a `authenticated`
3. ✅ Trigger ripristino F24 + 4 views reporting/KPI
4. ✅ Calcolo maggiorazione: `5000 → 7500 = 2500` (smoke test)
5. ✅ KPI effettivi escludono F24 interrotte per `F24_PAGOPA_LINK`

**Epic**: F24 ↔ PagoPA Linking System v1.0  
**Status**: ✅ Ready for Deployment (DB-only, zero frontend impact)  
**Backward Compatible**: Yes  
**Rollback**: Available (see ops runbook)

---

## [1.0.0] - 2024-XX-XX

### Added
- Initial release
- Rateations management system
- Installments tracking
- Payment recording (ordinary and ravvedimento)
- PagoPA integration
- Riammissione Quater support
- Dashboard with KPI cards
- Statistics and reporting
- PDF import/export functionality
- OCR-based data extraction

### Security
- Row Level Security (RLS) policies on all tables
- User authentication via Supabase Auth
- Owner-based access control for all rateations and installments

---

## Notes

- **DB-only migrations**: Deployable indipendentemente dal frontend (zero downtime)
- **Feature flags**: Nuove feature disabilitate di default in `.env.example`
- **Runbooks**: Tutti i deployment hanno runbook operativo in `docs/ops/`
- **Rollback**: Procedure di rollback documentate per tutte le migration critiche
