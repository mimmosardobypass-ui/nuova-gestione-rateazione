# RQ Allocation v1.0 - Release Notes

## 🚀 Nuova Funzionalità: Allocazione Multi-RQ

### Cosa cambia
- **Allocazione Fondi**: Possibilità di allocare quote PagoPA verso più Riammissioni Quater (RQ)
- **Migrazione Intelligente**: Dialog guidato per spostare fondi tra piani di pagamento
- **KPI Aggiornati**: Calcolo automatico del risparmio Quater basato sulle allocazioni

### Sicurezza & Robustezza
- ✅ **Filtri per Utente**: Tutte le query filtrate per `owner_uid`
- ✅ **Validazione Fail-Closed**: Solo quote > 0, nessuna over-allocazione
- ✅ **RPC Transazionale**: `link_pagopa_to_rq_atomic` race-safe
- ✅ **Fallback Intelligente**: Gestione automatica di colonne mancanti nella vista DB

### UX & Performance
- ✅ **Dialog Responsivo**: Compatibile Safari/mobile, nessun overflow
- ✅ **Validazione Real-time**: Bottone "Migra" abilitato solo con dati validi
- ✅ **Query Ottimizzate**: Limit ragionevoli, deduplicazione stabile
- ✅ **Feature Flag**: Attivazione controllata via `VITE_FEATURE_RQ_ALLOCATION`

### Criteri di Accettazione
1. **Bottone Migra**: Abilitato solo con PagoPA + RQ + quota valida
2. **Quota**: Validazione fail-closed (solo > 0), no over-allocation
3. **KPI Quater**: Somma `max(0, allocated_residual_cents - rq_total)` per RQ
4. **UI**: Nessun overflow su Safari/mobile
5. **Security**: Query filtrate per `owner_uid`

---

## 🏁 Deploy Checklist

### Pre-Flight
```bash
# Environment
export VITE_FEATURE_RQ_ALLOCATION=true
export VITE_SHOW_HEALTH=false

# Tests
npm test
npm run e2e:headless  
npm run smoke:sql
```

### Post-Deploy Verification
Vedere `docs/releases/post-deploy-verification.sh`

### Rollback (se necessario)
```bash
# Toggle feature flag
export VITE_FEATURE_RQ_ALLOCATION=false
# Restart FE - nessun impatto dati/KPI
```