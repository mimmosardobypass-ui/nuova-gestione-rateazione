# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Fixed - 2025-01-10 (Patch)

### Statistiche - Fix Normalizzazione Filtri & Ottimizzazioni

Corretti bug critici nei filtri statistiche: normalizzazione case-sensitive, gestione array vuoti, date e ottimizzazione re-render.

**Fixed**:
- **fix(stats)**: Normalizzazione UPPERCASE per status (`ATTIVA`, `INTERROTTA`, etc.) - eliminato confronto case-sensitive
- **fix(stats)**: Array vuoti (`[]`) convertiti a `null` per RPC Postgres (evita "no match")
- **fix(stats)**: Date normalizzate a formato `YYYY-MM-DD` per coerenza RPC
- **fix(stats)**: Ottimizzazione re-render con `useMemo` per `rpcArgs` (dipende da `filters` ma evita loop infiniti)
- **fix(stats)**: Cast espliciti `Number()` per valori numerici Postgres (evita stringhe)
- **fix(stats)**: Ordinamento stabile tabella "Per Tipologia": F24 → PagoPA → Rottamazione Quater → Riam. Quater → Altro

**Updated (Frontend)**:
- **update(frontend)**: Hook `useStatsByTypeEffective` con normalizzazione corretta
- **update(frontend)**: Hook `useStats` con stessa logica normalizzazione per coerenza

**Acceptance Criteria**:
1. ✅ Filtro "ATTIVA" funziona con qualsiasi case (attiva, ATTIVA, Attiva)
2. ✅ Array vuoti non causano "nessun risultato" inatteso
3. ✅ Date valide anche con oggetti Date JavaScript
4. ✅ Nessun re-render infinito sui filtri
5. ✅ Ordinamento tipologie stabile e prevedibile

**Backward Compatible**: Yes  
**Breaking Changes**: Nessuna (solo bugfix)

---

## Added - 2025-01-10

### Statistiche - Tabella "Per Tipologia" & KPI Alignment

Corretta la tabella "Per Tipologia" nelle statistiche per includere PagoPA e applicare correttamente la regola F24↔PagoPA per coerenza KPI.

**Fixed**:
- **fix(stats)**: Include PagoPA in tabella "Per Tipologia" (ora visibile con filtri corretti)
- **fix(stats)**: Applica regola F24↔PagoPA per residui/ritardi
  - F24 interrotte per link PagoPA (`interruption_reason='F24_PAGOPA_LINK'`) contribuiscono €0 a residuo/ritardo
  - PagoPA collegate vengono conteggiate correttamente
  - Nessun doppio conteggio tra F24 interrotte e PagoPA
- **fix(stats)**: Allinea KPI tra card e tabelle
  - Residuo Totale (card) = somma residui tabella "Per Tipologia"
  - In Ritardo (card) = somma ritardi tabella "Per Tipologia"
  - Tolleranza: ±1 EUR per arrotondamenti

**Added (Backend)**:
- **add(db)**: Nuova RPC `stats_per_tipologia_effective()` per filtri parametrici con regola F24↔PagoPA
- **add(db)**: Nuova vista `v_stats_per_tipologia_effective` come single source of truth
- **update(db)**: Aggiornata RPC `get_filtered_stats()` per applicare regola F24↔PagoPA a tutte le aggregazioni

**Added (Frontend)**:
- **add(frontend)**: Hook `useStatsByTypeEffective` per tabella "Per Tipologia" con dati corretti
- **update(frontend)**: Componente `StatsTables` usa nuova RPC per "Per Tipologia"

**Migration**: `supabase/migrations/20250110_stats_per_tipologia_effective.sql`

**Acceptance Criteria**:
1. ✅ Con filtri screenshot (tutte tipologie + attiva), tabella mostra: F24, PagoPA, Riam. Quater, Rottamazione Quater
2. ✅ Residuo Totale (card) = Σ residui (tabella per tipologia) ±1 EUR
3. ✅ Nessun doppio conteggio tra F24 interrotte e PagoPA collegate
4. ✅ Toggle "Includi interrotte/estinte" funziona correttamente
5. ✅ Performance: RPC < 500ms con 1000+ rateazioni

**Backward Compatible**: Yes  
**Breaking Changes**: Nessuna (solo fix + migliorie)

---

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
