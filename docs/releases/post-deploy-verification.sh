#!/bin/bash

# ========================================
# RQ Allocation v1.0 - Post-Deploy Verification Script
# ========================================

echo "🚀 RQ Allocation v1.0 - Verifica Post-Deploy"
echo "============================================="

# Colori per output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_check() {
    echo -e "${GREEN}✅${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠️${NC} $1"
}

print_error() {
    echo -e "${RED}❌${NC} $1"
}

echo ""
echo "📋 CHECKLIST MANUALE UI (2 minuti)"
echo "=================================="
echo ""
echo "1️⃣ SCENARIO BASE:"
echo "   - Vai su pagina Rateazioni"
echo "   - Apri MigrationDialog (bottone 'Migra')"
echo "   - Seleziona PagoPA N.34"
echo "   - Seleziona RQ5"
echo "   - Inserisci quota valida (es. 100)"
echo "   - Verifica: bottone 'Migra' è cliccabile"
echo "   - Clicca 'Migra' → deve mostrare successo"
echo ""
echo "2️⃣ SCENARIO MULTI-ALLOCAZIONE:"
echo "   - Ripeti con la stessa PagoPA N.34 → altra RQ"
echo "   - Verifica: residuo disponibile aggiornato"
echo "   - Verifica: KPI Quater senza doppi conteggi"
echo ""

read -p "✅ Hai completato la verifica manuale UI? (y/n): " ui_check
if [[ $ui_check != "y" ]]; then
    print_error "Completa la verifica UI prima di continuare"
    exit 1
fi

print_check "Verifica UI completata"

echo ""
echo "🔍 HEALTH CHECK PROGRAMMATICO"
echo "============================="

# Opzionale: se hai accesso alla console browser o a un endpoint di health check
echo "In console browser, esegui:"
echo ""
echo "// Health check RQ allocation"
echo "import { performRqHealthCheck } from '@/lib/queries/rq-monitoring';"
echo "performRqHealthCheck().then(result => {"
echo "  console.log('Health Check:', result);"
echo "  console.log('Is Healthy:', result.isHealthy);"
echo "  console.log('Issues:', result.totalIssues);"
echo "});"
echo ""

read -p "✅ Health check OK? (isHealthy === true o totalIssues === 0) (y/n): " health_check
if [[ $health_check != "y" ]]; then
    print_warning "Controlla i log per eventuali anomalie"
else
    print_check "Health check OK"
fi

echo ""
echo "📊 VERIFICA CONSOLE/SENTRY"
echo "========================="
echo ""
echo "Controlla che NON ci siano errori tipo:"
echo "- 'validation failed'"
echo "- 'over-allocation'"
echo "- 'owner_uid' missing"
echo "- Dialog overflow (Safari/mobile)"
echo ""

read -p "✅ Console/Sentry puliti? (y/n): " logs_check
if [[ $logs_check != "y" ]]; then
    print_error "Controlla i log di errore"
    exit 1
fi

print_check "Console/Sentry OK"

echo ""
echo "⚡ PERFORMANCE (OPZIONALE)"
echo "========================"
echo ""
echo "Se vuoi ottimizzare le query, esegui in SQL Editor:"
echo ""
echo "-- Indici per performance RQ allocation"
echo "CREATE INDEX IF NOT EXISTS idx_links_pagopa ON riam_quater_links(pagopa_id);"
echo "CREATE INDEX IF NOT EXISTS idx_links_rq ON riam_quater_links(riam_quater_id);"
echo ""

read -p "⚡ Vuoi applicare gli indici di performance? (y/n): " perf_check
if [[ $perf_check == "y" ]]; then
    print_check "Applica gli indici via SQL Editor Supabase"
else
    print_warning "Indici performance saltati (OK per ora)"
fi

echo ""
echo "🎯 CRITERI DI ACCETTAZIONE FINALI"
echo "================================="
echo ""

criteria=(
    "Bottone 'Migra' abilitato solo con PagoPA + RQ + quota valida"
    "Quota fail-closed (solo > 0), no over-allocation"
    "KPI Quater = somma max(0, allocated_residual_cents - rq_total) per RQ"
    "UI senza overflow anche su Safari/mobile"
    "Query filtrate per owner_uid"
)

for criterion in "${criteria[@]}"; do
    read -p "✅ $criterion (y/n): " check
    if [[ $check != "y" ]]; then
        print_error "Criterio non soddisfatto: $criterion"
        exit 1
    fi
done

echo ""
print_check "🎉 DEPLOY VERIFICATO CON SUCCESSO!"
echo ""
echo "📋 ROLLBACK PLAN (se mai servisse):"
echo "   export VITE_FEATURE_RQ_ALLOCATION=false"
echo "   Restart FE"
echo ""
echo "📈 FOLLOW-UP VIEW (opzionale, non bloccante):"
echo "   - v_pagopa_allocations_v2 con has_links nativa"
echo "   - Deprecazione v1 quando v2 stabile"
echo ""
print_check "RQ Allocation v1.0 è in produzione! 🚀"