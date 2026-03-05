

## Bug: Lo stato della rata non si aggiorna dopo il pagamento

### Causa root

In `InstallmentPaymentActions.handleMarkPaidOrdinary` (righe 85-87), vengono chiamati in sequenza:
1. `onReload()` → `debouncedReload` → imposta timeout per chiamare `load()` + `reloadStats()` dopo 200ms
2. `onStatsReload()` → `debouncedReloadStats` → **cancella il timeout precedente** e ne imposta uno nuovo che chiama **solo** `reloadStats()`

Il problema e' che `debouncedReload` e `debouncedReloadStats` condividono lo stesso `timeoutRef`. Quindi la seconda chiamata cancella la prima, e `load()` (che ri-carica le rate dal server) non viene mai eseguita. Il risultato: lo stato "Pagata/In ritardo" non si aggiorna perche' `items` non viene mai ricaricato.

### Soluzione

Nel file `RateationRowDetailsPro.tsx`, separare i due callback passati a `InstallmentPaymentActions`:
- `onReload` chiama direttamente `load()` (senza debounce) per aggiornare immediatamente le rate
- `onStatsReload` resta debounced per le statistiche

### Dettaglio tecnico

**File: `src/features/rateations/components/RateationRowDetailsPro.tsx`** (riga 641)

Cambiare il prop `onReload` passato a `InstallmentPaymentActions` da `debouncedReload` a `load` diretto:

```diff
  <InstallmentPaymentActions
    rateationId={rateationId}
    installment={it}
-   onReload={debouncedReload}
+   onReload={load}
    onStatsReload={debouncedReloadStats}
    disabled={!online || rateationInfo?.status === 'ESTINTA'}
  />
```

Questo garantisce che dopo un pagamento, le rate vengano ricaricate immediatamente dal server, aggiornando lo stato nella colonna "Stato" senza bisogno di refresh manuale.

### Garanzia dati
- Nessuna modifica alle API o al database
- Nessuna modifica alla logica di pagamento
- Solo il trigger di reload viene cambiato da debounced a diretto

