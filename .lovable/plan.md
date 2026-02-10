
## Piano: Bottone "Aggiorna" sotto il calendario per rate pagate

### Problema
La modifica data attualmente salva automaticamente al click sulla data nel calendario, ma il salvataggio non sempre si riflette nella UI. L'utente vuole un flusso piu' controllato.

### Soluzione
Separare la selezione della data dalla conferma del salvataggio:
1. L'utente clicca sulla data per aprire il calendario
2. Seleziona la nuova data (senza salvare)
3. Preme il bottone verde "Aggiorna" sotto il calendario per confermare

### Modifica: `src/features/rateations/components/InstallmentPaymentActions.tsx`

**Sezione rata pagata ordinaria (righe 191-216):**

- Aggiungere uno stato locale `pendingEditDate` per la data selezionata ma non ancora confermata
- Il `Calendar.onSelect` aggiornera' solo `pendingEditDate` (senza chiamare l'API)
- Sotto il calendario, aggiungere un bottone "Aggiorna" verde che:
  - Chiama `handleMarkPaidOrdinary(pendingEditDate)` per salvare
  - Chiude il popover dopo il successo
  - Mostra "Aggiornando..." durante il salvataggio
- Il bottone e' disabilitato se la data selezionata e' uguale a quella attuale

### Comportamento visivo

```
[Pagata]
[10/02/2026 (icona calendario)] <-- click apre popover

Popover aperto:
+---------------------------+
|  Calendario febbraio 2026 |
|  [seleziona nuova data]   |
|                           |
| [   Aggiorna (verde)   ] |
+---------------------------+
```

### Dettaglio tecnico

1. Nuovo stato: `pendingEditDate` inizializzato alla data corrente quando il popover si apre
2. `Calendar.onSelect` -> aggiorna solo `pendingEditDate`
3. Bottone "Aggiorna" -> chiama `handleMarkPaidOrdinary(pendingEditDate)`, poi `setEditDateOpen(false)`
4. Quando `editDateOpen` cambia a `true`, inizializzare `pendingEditDate` con la data attuale
5. Bottone disabilitato durante il salvataggio (`saving`) o se la data non e' cambiata

### Sicurezza dati
- Stesso flusso API esistente (`markInstallmentPaidOrdinary`)
- L'aggiornamento avviene solo al click esplicito su "Aggiorna"
- L'optimistic update e il useEffect di sync restano invariati

### File da modificare
- `src/features/rateations/components/InstallmentPaymentActions.tsx` (sezione popover modifica data, circa 20 righe)
