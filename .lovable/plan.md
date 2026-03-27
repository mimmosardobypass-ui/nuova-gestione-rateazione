

## Implementazione: Prima rata PagoPA tassativa + Sezione "Prossime Scadenze"

### Problema
Una nuova PagoPA (es. N.45) non appare nel report a rischio perche ha 0 rate scadute e 8 skip residui. Ma la prima rata e tassativa: se non pagata, rischio decadenza immediata.

### Soluzione

#### 1. Nuovo hook `usePagopaUpcoming`
File: `src/features/rateations/hooks/usePagopaUpcoming.ts`

Logica:
- Query tutte le PagoPA attive (`v_rateations_list_ui` con `is_pagopa=true`, `status=attiva`)
- Per ciascuna, trova la prima rata non pagata con `due_date` nei prossimi 30 giorni
- **Regola prima rata tassativa**: se la rata e `seq=1` (prima rata), il rischio e sempre ALTO indipendentemente dagli skip
- Escludi le PagoPA gia presenti nella sezione critica (quelle con >=7 overdue e <=1 skip)
- Risultato: array `PagopaUpcomingItem[]` con `rateationId`, `numero`, `contribuente`, `nextDueDate`, `daysRemaining`, `amountCents`, `isFirstInstallment` (bool), `unpaidOverdueCount`, `skipRemaining`

Strategia query:
1. Query `v_pagopa_today_kpis` per TUTTE le PagoPA (non solo quelle critiche)
2. Filtra via quelle gia critiche (>=7 overdue AND <=1 skip)
3. Query `installments` per le rimanenti: prima rata non pagata con scadenza entro 30gg
4. Includi il campo `seq` per identificare la prima rata

#### 2. Aggiornare `usePagopaAtRisk` - Prima rata tassativa
File: `src/features/rateations/hooks/usePagopaAtRisk.ts`

Aggiungere una seconda query: PagoPA attive dove la prima rata (`seq=1`) non e pagata e scade entro 30 giorni, indipendentemente dagli skip. Queste vanno aggiunte all'array `atRiskPagopas` con un flag `isFirstInstallmentRisk: true`.

Questo garantisce che N.45 appaia nell'alert critico se la prima rata sta per scadere.

#### 3. Aggiornare `useAllAtRisk`
File: `src/features/rateations/hooks/useAllAtRisk.ts`

- Importare `usePagopaUpcoming`
- Esporre `pagopaUpcoming` nel risultato
- Includere nel conteggio totale

#### 4. Report stampa - Nuova sezione "Prossime Scadenze"
File: `src/pages/print/RateazioniAtRisk.tsx`

Dopo la sezione PagoPA critica, aggiungere:
- Titolo: "PagoPA - Prossime Scadenze (30gg)"
- Badge: 🔴 PRIMA RATA per `isFirstInstallment=true`, 🟡 ATTENZIONE per <=7gg, 🟢 PROMEMORIA per 8-30gg
- Colonne: Numero, Contribuente, Importo Rata, Scadenza, Giorni, Rischio
- KPI: conteggio, di cui prime rate, giorni minimi

#### 5. Report stampa dedicato PagoPA
File: `src/pages/print/PagopaAtRisk.tsx`

Aggiungere la stessa sezione "Prossime Scadenze" anche qui.

#### 6. HomePage alert
File: `src/pages/HomePage.tsx`

Aggiungere un alert separato per le scadenze imminenti PagoPA (o integrare il conteggio nell'alert PagoPA esistente con messaggio aggiuntivo).

### File da creare/modificare
- **Creare**: `src/features/rateations/hooks/usePagopaUpcoming.ts`
- **Modificare**: `src/features/rateations/hooks/usePagopaAtRisk.ts` (prima rata tassativa nel critico)
- **Modificare**: `src/features/rateations/hooks/useAllAtRisk.ts`
- **Modificare**: `src/pages/print/RateazioniAtRisk.tsx`
- **Modificare**: `src/pages/print/PagopaAtRisk.tsx`
- **Modificare**: `src/pages/HomePage.tsx`

### Nessuna modifica DB
Tutti i dati necessari sono gia disponibili nelle viste e tabelle esistenti (`v_pagopa_today_kpis`, `installments.seq`, `v_rateations_list_ui`).

