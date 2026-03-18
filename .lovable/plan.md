

## Gestione PagoPA in attesa Rottamazione Quinquies

### Analisi

Dopo aver verificato il codice, l'infrastruttura necessaria e' gia' completa:

- **Flag `is_quinquies`** nella tabella `rateations` 
- **Tabella `quinquies_links`** per tracciare i collegamenti PagoPA → R5
- **MigrationDialog** supporta gia' la selezione di destinazioni R5 (filtra per `is_quinquies`)
- **KPI dashboard** categorizza gia' "PagoPA Migrate R5" separatamente dalle attive
- **Badge "R5"** gia' visibile nelle tabelle per distinguere da RQ

### Cosa fare (tutto da UI esistente, zero modifiche al codice)

1. **Creare una rateazione placeholder R5** tramite il dialog "Nuova Rateazione":
   - Numero: `R5-PROVVISORIA` (o simile)
   - Tipo: Rottamazione Quinquies
   - Importo: €0 / 1 rata da €0
   - Contribuente: nome del contribuente

2. **Per ogni PagoPA da sospendere**, aprire il dialog "Gestisci Migrazione" e collegare alla R5 provvisoria. Il sistema automaticamente:
   - Imposta lo stato PagoPA a `INTERROTTA`
   - Registra snapshot del residuo al momento del collegamento
   - Esclude la PagoPA dai KPI attivi
   - Mostra la categorizzazione "PagoPA Migrate R5" nel dashboard

3. **A luglio 2026**, quando arriva il piano definitivo:
   - Aggiornare la rateazione R5 con importi e rate reali
   - I link e gli snapshot restano immutati

### Nessuna modifica al codice necessaria

Tutte le funzionalita' sono gia' implementate. Non serve toccare ne' codice ne' dati esistenti. L'operazione si fa interamente dalla UI.

