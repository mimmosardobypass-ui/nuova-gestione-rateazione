#!/usr/bin/env bash
# ============================================================================
# Deploy Script: F24 ↔ PagoPA Linking System v1.0
# Date: 2025-01-09
# Environment: Staging/Production (DB-only migration)
# ============================================================================

set -euo pipefail

echo "=================================="
echo "F24 ↔ PagoPA v1.0 - DB Migration"
echo "=================================="
echo ""

# Verifica che DATABASE_URL sia impostata
if [ -z "${DATABASE_URL:-}" ]; then
  echo "❌ ERROR: DATABASE_URL not set"
  echo "   Please set DATABASE_URL environment variable"
  exit 1
fi

echo "✅ DATABASE_URL is set"
echo ""

# Path migration
MIGRATION_FILE="supabase/migrations/20250109_f24_pagopa_links.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
  echo "❌ ERROR: Migration file not found: $MIGRATION_FILE"
  exit 1
fi

echo "📦 Found migration file: $MIGRATION_FILE"
echo ""

# Esegui migration
echo "🚀 Executing migration..."
psql "$DATABASE_URL" -f "$MIGRATION_FILE"

if [ $? -eq 0 ]; then
  echo "✅ Migration executed successfully"
else
  echo "❌ Migration failed"
  exit 1
fi

echo ""
echo "=================================="
echo "Post-Deploy Validation Checks"
echo "=================================="
echo ""

# CHECK 1: Verifica trigger
echo "📋 CHECK 1: Trigger trg_restore_f24_on_link_delete"
echo "---"
psql "$DATABASE_URL" -c "SELECT tgname FROM pg_trigger WHERE tgname='trg_restore_f24_on_link_delete';"
echo ""

# CHECK 2: Verifica grants RPC (NO public, solo authenticated)
echo "📋 CHECK 2: RPC Grants (should be 'authenticated' only, NO 'public')"
echo "---"
psql "$DATABASE_URL" -c "
SELECT routine_name, grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_name IN (
  'link_f24_to_pagopa_atomic',
  'unlink_f24_from_pagopa',
  'get_pagopa_available_for_f24'
)
ORDER BY routine_name, grantee;
"
echo ""

# CHECK 3: Verifica KPI view restituisce valore numerico
echo "📋 CHECK 3: KPI View v_kpi_rateations_effective (should return numeric)"
echo "---"
psql "$DATABASE_URL" -c "SELECT effective_residual_amount_cents FROM v_kpi_rateations_effective LIMIT 1;"
echo ""

# CHECK 4: Smoke test maggiorazione (se esistono dati)
echo "📋 CHECK 4: Maggiorazione View (smoke test if data exists)"
echo "---"
psql "$DATABASE_URL" -c "
SELECT
  snapshot_f24_residual_cents/100.0 AS f24_snapshot_eur,
  pagopa_total_cents/100.0          AS pagopa_total_eur,
  maggiorazione_allocata_cents/100.0 AS maggiorazione_eur
FROM v_f24_pagopa_maggiorazione
ORDER BY link_id DESC
LIMIT 1;
"
echo ""

echo "=================================="
echo "✅ Deployment Complete"
echo "=================================="
echo ""
echo "Next Steps:"
echo "1. Review the 4 check outputs above"
echo "2. If Check 2 shows 'public' grantee, run:"
echo "   REVOKE ALL ON FUNCTION ... FROM PUBLIC;"
echo "3. If Check 4 returns 0 rows, run smoke test setup from runbook"
echo "4. Update DevOps ticket with validation results"
echo ""
