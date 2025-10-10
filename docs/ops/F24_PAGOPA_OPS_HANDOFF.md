# F24 ↔ PagoPA Linking System v1.0 - Ops Runbook

**Date**: 2025-01-09  
**Epic**: F24 ↔ PagoPA Linking System v1.0 (DB-only Migration)  
**Owner**: DevOps Team  
**Status**: Ready for Deployment

---

## 📋 Overview

Implementazione DB-only per collegamento bidirezionale F24 ↔ PagoPA con:
- **Snapshot immutabili** al momento del link
- **Maggiorazione automatica** (PagoPA - F24)
- **KPI effettivi** (escludono F24 INTERROTTE per link)
- **Ripristino automatico** F24 su unlink

---

## 🚀 Deployment Procedure

### Prerequisites
- ✅ PostgreSQL 14+ con accesso admin
- ✅ `DATABASE_URL` configurata (staging/production)
- ✅ Migration file: `supabase/migrations/20250109_f24_pagopa_links.sql`
- ✅ Deploy script: `docs/ops/deploy_f24_pagopa.sh`

### Execution Steps

#### Step 1: Pre-Deploy Checks
```bash
# Verifica presenza file
ls -la supabase/migrations/20250109_f24_pagopa_links.sql
ls -la docs/ops/deploy_f24_pagopa.sh

# Verifica DATABASE_URL (senza stamparla!)
echo ${DATABASE_URL:+DATABASE_URL is set}
```

#### Step 2: Execute Deployment
```bash
# Rendi eseguibile lo script
chmod +x docs/ops/deploy_f24_pagopa.sh

# Esegui deployment con log
./docs/ops/deploy_f24_pagopa.sh | tee deploy_f24_pagopa_$(date +%Y%m%d_%H%M%S).log
```

#### Step 3: Post-Deploy Validation
Lo script esegue automaticamente 4 check. Copia i risultati nel ticket DevOps.

**Expected Outputs**:

**CHECK 1 - Trigger Exists**
```
 tgname
------------------------------------------
 trg_restore_f24_on_link_delete
(1 row)
```

**CHECK 2 - RPC Grants (NO public!)**
```
 routine_name                 | grantee        | privilege_type
------------------------------+----------------+----------------
 get_pagopa_available_for_f24 | authenticated  | EXECUTE
 link_f24_to_pagopa_atomic    | authenticated  | EXECUTE
 unlink_f24_from_pagopa       | authenticated  | EXECUTE
(3 rows)
```
⚠️ **CRITICAL**: Se vedi `public` nei grantee, esegui Quick Fix #1 (vedi sotto)

**CHECK 3 - KPI View Returns Numeric**
```
 effective_residual_amount_cents
---------------------------------
                        12345678
(1 row)
```

**CHECK 4 - Maggiorazione Smoke Test**
```
 f24_snapshot_eur | pagopa_total_eur | maggiorazione_eur
------------------+------------------+-------------------
          5000.00 |          7500.00 |           2500.00
(1 row)
```
⚠️ Se ritorna 0 rows, esegui Quick Fix #2 (vedi sotto)

---

## 🔧 Quick Fixes

### Quick Fix #1: Remove Public Grants
Se CHECK 2 mostra `public` nei grantee:
```sql
-- Connetti a DB e esegui
REVOKE ALL ON FUNCTION public.link_f24_to_pagopa_atomic FROM PUBLIC;
REVOKE ALL ON FUNCTION public.unlink_f24_from_pagopa FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_pagopa_available_for_f24 FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.link_f24_to_pagopa_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION public.unlink_f24_from_pagopa TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pagopa_available_for_f24 TO authenticated;

-- Ripeti CHECK 2
SELECT routine_name, grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_name IN (
  'link_f24_to_pagopa_atomic',
  'unlink_f24_from_pagopa',
  'get_pagopa_available_for_f24'
)
ORDER BY routine_name, grantee;
```

### Quick Fix #2: Smoke Test Setup
Se CHECK 4 ritorna 0 rows (normale in ambiente pulito):
```sql
-- Setup dati di test (solo per validazione)
-- 1. Crea tipo F24
INSERT INTO rateation_types (id, name, owner_uid)
VALUES (9999, 'F24', (SELECT auth.uid()))
ON CONFLICT DO NOTHING;

-- 2. Crea tipo PagoPA
INSERT INTO rateation_types (id, name, owner_uid)
VALUES (9998, 'PagoPA', (SELECT auth.uid()))
ON CONFLICT DO NOTHING;

-- 3. Crea F24 test
INSERT INTO rateations (id, owner_uid, type_id, number, is_f24, status)
VALUES (999991, auth.uid(), 9999, 'F24-TEST-001', TRUE, 'ATTIVA')
ON CONFLICT DO NOTHING;

-- 4. Crea installments F24 (residuo €5000)
INSERT INTO installments (rateation_id, seq, due_date, amount, amount_cents, is_paid, owner_uid)
VALUES
  (999991, 1, '2025-01-15', 5000, 500000, FALSE, auth.uid())
ON CONFLICT DO NOTHING;

-- 5. Crea PagoPA test
INSERT INTO rateations (id, owner_uid, type_id, number, status)
VALUES (999992, auth.uid(), 9998, 'PAG-TEST-001', 'ATTIVA')
ON CONFLICT DO NOTHING;

-- 6. Crea installments PagoPA (totale €7500)
INSERT INTO installments (rateation_id, seq, due_date, amount, amount_cents, is_paid, owner_uid)
VALUES
  (999992, 1, '2025-02-15', 7500, 750000, FALSE, auth.uid())
ON CONFLICT DO NOTHING;

-- 7. Crea link (maggiorazione = 7500 - 5000 = 2500)
SELECT * FROM link_f24_to_pagopa_atomic(999991, 999992, 'Test smoke deployment');

-- 8. Ripeti CHECK 4
SELECT
  snapshot_f24_residual_cents/100.0 AS f24_snapshot_eur,
  pagopa_total_cents/100.0          AS pagopa_total_eur,
  maggiorazione_allocata_cents/100.0 AS maggiorazione_eur
FROM v_f24_pagopa_maggiorazione
WHERE f24_id = 999991;
```

**Expected**: `5000.00 | 7500.00 | 2500.00`

**Cleanup** (dopo validazione):
```sql
DELETE FROM f24_pagopa_links WHERE f24_id = 999991;
DELETE FROM installments WHERE rateation_id IN (999991, 999992);
DELETE FROM rateations WHERE id IN (999991, 999992);
```

---

## ✅ Acceptance Criteria (Immutabili)

### Criterio 1: Tabella e RLS
- [x] Tabella `f24_pagopa_links` creata
- [x] Indici su `f24_id`, `pagopa_id`, `linked_at`
- [x] 4 RLS policies attive (SELECT, INSERT, UPDATE, DELETE)
- [x] Constraint `uq_f24_single_active_link` presente

### Criterio 2: 3 RPC Atomiche
- [x] `link_f24_to_pagopa_atomic` (SECURITY DEFINER, solo authenticated)
- [x] `unlink_f24_from_pagopa` (SECURITY DEFINER, solo authenticated)
- [x] `get_pagopa_available_for_f24` (SECURITY DEFINER, solo authenticated)
- [x] ⚠️ **NESSUN grant a `public`** (vedi CHECK 2)

### Criterio 3: Trigger e Views
- [x] Trigger `trg_restore_f24_on_link_delete` (ripristino F24)
- [x] View `v_f24_pagopa_maggiorazione` (report)
- [x] View `v_f24_linked_status` (stato link)
- [x] View `v_kpi_rateations_effective` (KPI residuo)
- [x] View `v_kpi_rateations_overdue_effective` (KPI overdue)

### Criterio 4: Calcolo Maggiorazione
- [x] Formula: `MAX(0, PagoPA_totale - F24_residuo)`
- [x] Snapshot immutabili al momento del link
- [x] Validazione smoke: `5000 → 7500 = 2500` (CHECK 4)

### Criterio 5: KPI Effettivi
- [x] Esclusi F24 con `status = 'INTERROTTA' AND interruption_reason = 'F24_PAGOPA_LINK'`
- [x] Residuo effettivo: `v_kpi_rateations_effective`
- [x] Overdue effettivo: `v_kpi_rateations_overdue_effective`

---

## 🔍 Troubleshooting

### Issue: Migration fails with "table already exists"
**Causa**: Migration eseguita più volte  
**Fix**: Usa `CREATE TABLE IF NOT EXISTS` (già nel file)

### Issue: CHECK 2 mostra 'public' nei grants
**Causa**: Grants di default PostgreSQL  
**Fix**: Esegui Quick Fix #1 (revoke public, grant authenticated)

### Issue: CHECK 4 ritorna 0 rows
**Causa**: DB vuoto (normale in staging pulito)  
**Fix**: Esegui Quick Fix #2 (smoke test setup)

### Issue: RPC failure "F24_ACCESS_DENIED"
**Causa**: RLS policy mancante o user non owner  
**Fix**: Verifica ownership con:
```sql
SELECT id, number, owner_uid, is_f24
FROM rateations
WHERE id = <f24_id>;
```

---

## 📊 Rollback Procedure (Emergency Only)

⚠️ **WARNING**: Rollback elimina tabella, RPC, trigger e views. Dati link persi.

```sql
-- 1. Drop views
DROP VIEW IF EXISTS public.v_kpi_rateations_overdue_effective CASCADE;
DROP VIEW IF EXISTS public.v_kpi_rateations_effective CASCADE;
DROP VIEW IF EXISTS public.v_f24_linked_status CASCADE;
DROP VIEW IF EXISTS public.v_f24_pagopa_maggiorazione CASCADE;

-- 2. Drop trigger e function
DROP TRIGGER IF EXISTS trg_restore_f24_on_link_delete ON public.f24_pagopa_links;
DROP FUNCTION IF EXISTS public.trg_restore_f24_on_link_delete CASCADE;

-- 3. Drop RPC
DROP FUNCTION IF EXISTS public.get_pagopa_available_for_f24 CASCADE;
DROP FUNCTION IF EXISTS public.unlink_f24_from_pagopa CASCADE;
DROP FUNCTION IF EXISTS public.link_f24_to_pagopa_atomic CASCADE;

-- 4. Drop tabella (CASCADE elimina foreign keys)
DROP TABLE IF EXISTS public.f24_pagopa_links CASCADE;

-- 5. Ripristina F24 a ATTIVA (manuale se necessario)
UPDATE rateations
SET status = 'ATTIVA',
    interruption_reason = NULL,
    interrupted_at = NULL
WHERE status = 'INTERROTTA'
  AND interruption_reason = 'F24_PAGOPA_LINK';
```

**Post-Rollback**: Notifica Dev Team e Product Owner

---

## 📞 Contacts & Escalation

**Dev Lead**: [TBD]  
**DevOps Lead**: [TBD]  
**Product Owner**: [TBD]

**Escalation Path**:
1. Quick Fixes (questo runbook)
2. DevOps Lead (infra issues)
3. Dev Lead (logic issues)
4. Product Owner (acceptance changes)

---

## 📝 Deployment Checklist

**Pre-Deploy**:
- [ ] Migration file reviewed
- [ ] Deploy script tested in dev
- [ ] DATABASE_URL configured
- [ ] Backup DB (se production)

**Deploy**:
- [ ] Script eseguito senza errori
- [ ] 4 check completati
- [ ] Output salvati in ticket

**Post-Deploy**:
- [ ] CHECK 1: Trigger presente ✅
- [ ] CHECK 2: Solo `authenticated` (NO public) ✅
- [ ] CHECK 3: KPI view restituisce numero ✅
- [ ] CHECK 4: Maggiorazione = 2500 ✅
- [ ] Quick Fixes applicati (se necessari)
- [ ] Ticket DevOps aggiornato con output
- [ ] Dev Lead notificato per merge

**Sign-Off**:
- [ ] DevOps: Deployment completato
- [ ] Dev Lead: Acceptance validated
- [ ] Product Owner: Epic closed

---

**Document Version**: 1.0  
**Last Updated**: 2025-01-09  
**Next Review**: Post-deployment (after prod validation)
