
Problema verificato: il dato di collegamento R5 esiste davvero in database, ma la riga della PagoPA in lista non lo riceve né lo usa per la UI.

Cosa ho verificato
- Per `N.43 PagoPa` esiste un link attivo in `quinquies_links` verso `N.1Quinquies`.
- La stessa rateazione ha `status = INTERROTTA`, ma `interrupted_by_rateation_id = null`.
- La UI della colonna “Numero” mostra il dettaglio sotto al badge solo se trova:
  - campi `linked_rq_*` per le RQ, oppure
  - dati F24 tramite `interruption_reason === 'F24_PAGOPA_LINK'`.
- Oggi non esistono campi equivalenti per i link R5 nel flusso lista:
  - `v_rateations_list_ui` espone solo `linked_rq_count`, `latest_linked_rq_number`, `latest_rq_id`
  - `RateationListRow.schema.ts` valida solo quei campi
  - `mapRateationListRow.ts` mappa solo quei campi
  - `RateationNumberCell.tsx` renderizza solo RQ e F24

Root cause
La logica R5 è stata implementata nella card dettaglio `PagopaLinks`, ma non nella sorgente dati della tabella principale né nel componente che disegna il sottotitolo della rateazione. Per questo la PagoPA resta visivamente “solo Interrotta”.

Correzione proposta
1. Estendere la view `v_rateations_list_ui`
- Aggiungere un blocco aggregato per `quinquies_links` attivi, simile a `rq_links`.
- Esporre almeno:
  - `linked_r5_count`
  - `latest_linked_r5_number`
  - `latest_r5_id`
- Idealmente usare `ORDER BY created_at DESC LIMIT 1` per il “latest”, come già fatto per RQ.

2. Allineare contratto dati frontend
- Aggiornare `src/schemas/RateationListRow.schema.ts`
- Aggiornare `src/features/rateations/types.ts`
- Aggiornare `src/mappers/mapRateationListRow.ts`
In questo modo `useAllRateations()` passerà i nuovi campi alla tabella senza rompere la validazione Zod.

3. Aggiornare `RateationNumberCell.tsx`
- Introdurre la logica:
  - `hasRqLinks`
  - `hasR5Links`
- Continuare a mostrare:
  - `→ collegata a X RQ` per RQ
- Aggiungere:
  - `→ collegata a N.1Quinquies` quando esiste un link R5 attivo
- Sotto, mostrare un chip cliccabile con il numero R5, esattamente come oggi avviene per i numeri RQ.
- Se in futuro ci fossero più R5 collegate, valutare:
  - singolo numero se count=1
  - `→ collegata a X R5` + chips se count>1

4. Mantenere compatibilità con l’attuale UX
- Nessuna modifica al badge “Interrotta”
- Nessun cambio alla card dettaglio già fatta
- Nessun cambio al dialog di migrazione
- Solo completamento della visualizzazione nella lista, coerente con lo screen di esempio RQ

Perché questa è la correzione giusta
- Il problema non è nel link o nel salvataggio: il link R5 esiste.
- Il problema non è nemmeno solo nel componente: i dati R5 non arrivano proprio alla tabella.
- Quindi serve una correzione full-path:
```text
quinquies_links
  -> v_rateations_list_ui
  -> Zod schema
  -> mapper UI
  -> RateationNumberCell
```

File da modificare
- `supabase/migrations/...sql` per ricreare `v_rateations_list_ui` con i campi R5
- `src/schemas/RateationListRow.schema.ts`
- `src/features/rateations/types.ts`
- `src/mappers/mapRateationListRow.ts`
- `src/features/rateations/components/RateationNumberCell.tsx`

Nota importante
Non conviene basarsi su `interrupted_by_rateation_id` per R5, perché dal dato reale che ho verificato quel campo è nullo anche se il link attivo esiste. La sorgente affidabile per la visualizzazione è `quinquies_links`, come già accade per RQ tramite `riam_quater_links`.
