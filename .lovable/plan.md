
## Piano: Modifica data pagamento per rate gia' pagate

### Problema attuale
Quando una rata e' gia' pagata, la data viene mostrata come testo statico. Per correggerla, l'utente deve:
1. Annullare il pagamento
2. Riselezionare la data corretta

Questo flusso e' scomodo e rischioso (si potrebbe dimenticare di ripagare).

### Soluzione proposta
Rendere la data di pagamento cliccabile tramite un date picker inline. L'utente clicca sulla data, seleziona la nuova data dal calendario, e il sistema aggiorna automaticamente il pagamento.

### Comportamento previsto
- La data pagamento diventa un bottone cliccabile con icona calendario
- Al click si apre il calendario con la data attuale pre-selezionata
- Selezionando una nuova data, il sistema aggiorna il record chiamando la stessa API `markInstallmentPaidOrdinary` con la nuova data
- Per le rate pagate con ravvedimento, la modifica data sara' disabilitata (il ravvedimento dipende dalla data, quindi va annullato e rifatto)
- Un toast conferma l'avvenuto aggiornamento
- I dati esistenti non vengono mai compromessi: l'update avviene solo su conferma esplicita dell'utente

### Dettaglio tecnico

**File: `src/features/rateations/components/InstallmentPaymentActions.tsx`**

Nella sezione "rata pagata" (righe 158-183), sostituire il testo statico della data con un Popover + Calendar:

1. Aggiungere stato `isEditingDate` e `editDateOpen` per gestire il popover di modifica
2. Aggiungere funzione `handleUpdatePaymentDate` che chiama `markInstallmentPaidOrdinary` con il nuovo valore
3. Sostituire il `<div className="text-muted-foreground">` con un `<Popover>` contenente un `<Calendar>`
4. Per `payment_mode === 'ravvedimento'`, la data resta non modificabile (testo statico) con un tooltip che spiega il motivo

```
Rata pagata ordinaria:
[Pagata]
[20/02/2025 (icona calendario)] <-- cliccabile, apre calendario
[Annulla pagamento]

Rata pagata con ravvedimento:
[Pagata (Rav.)]
[20/02/2025] <-- testo statico, non modificabile
Quota: ... Extra: ... Totale: ...
[Annulla pagamento]
```

### Sicurezza dati
- La modifica chiama la stessa RPC `mark_installment_paid_ordinary_new` gia' in uso
- Nessuna nuova migrazione necessaria
- I dati di ravvedimento non vengono toccati
- L'aggiornamento avviene solo dopo selezione esplicita di una nuova data dal calendario
- Dopo l'aggiornamento vengono ricaricati i dati (onReload, onReloadList, onStatsReload)

### File da modificare
- `src/features/rateations/components/InstallmentPaymentActions.tsx` (sezione rata pagata, circa 15 righe modificate)
