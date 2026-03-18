

## Migrazione PagoPA verso Rottamazione Quinquies (R5)

### Problema
Il dialog di migrazione non mostra le rateazioni R5 come destinazione perche':
1. **RPC `get_rq_available_for_pagopa`** filtra solo `is_quater = true`, escludendo R5
2. **RPC `pagopa_link_rq_v2`** valida che la destinazione sia Quater (`is_quater = true` o tipo LIKE '%QUATER%') e scrive su `riam_quater_links`
3. **Non esiste nessuna RPC** per collegare PagoPA a R5 (`quinquies_links`)

### Soluzione

Servono modifiche sia lato database (2 nuove RPC) che lato frontend (MigrationDialog).

---

#### 1. Nuova RPC: `get_r5_available_for_pagopa`
Analoga a `get_rq_available_for_pagopa` ma filtra per `is_quinquies = true`:
- Restituisce rateazioni R5 dell'utente, non decadute, non gia' collegate nella `quinquies_links`

#### 2. Nuova RPC: `pagopa_link_r5_v2`
Analoga a `pagopa_link_rq_v2` ma:
- Valida che la destinazione abbia `is_quinquies = true`
- Inserisce in `quinquies_links` (con `quinquies_id` invece di `riam_quater_id`)
- Cattura snapshot (residuo PagoPA, totale R5, taxpayer) e calcola risparmio
- Imposta la PagoPA come INTERROTTA

#### 3. Frontend: `MigrationDialog.tsx`
- Aggiungere un selettore "Tipo destinazione" (RQ 2024 / R5 2026) quando `migrationMode === 'pagopa'`
- In base alla scelta, caricare le opzioni da `get_rq_available_for_pagopa` o `get_r5_available_for_pagopa`
- Alla migrazione, chiamare `pagopa_link_rq_v2` o `pagopa_link_r5_v2` rispettivamente
- Aggiornare le label ("Migra a N RQ" → "Migra a N R5")

#### 4. Frontend: `linkPagopa.ts`
- Aggiungere funzione `migratePagopaAttachR5(pagopaId, r5Ids, note?)` che chiama `pagopa_link_r5_v2`

#### 5. Frontend: `rq.ts`
- Aggiungere funzione `fetchSelectableR5ForPagopa(pagopaId)` che chiama `get_r5_available_for_pagopa`

#### 6. Rigenerare tipi Supabase
- Aggiungere le nuove RPC al file `types.ts`

### Flusso utente finale
1. Apre "Gestisci Migrazione" su una PagoPA
2. Seleziona la PagoPA sorgente
3. Sceglie "Rottamazione Quinquies (2026)" come tipo destinazione
4. Vede la rateazione R5 provvisoria nella lista
5. La seleziona e clicca "Migra a 1 R5"
6. La PagoPA diventa INTERROTTA, il link viene salvato in `quinquies_links`

