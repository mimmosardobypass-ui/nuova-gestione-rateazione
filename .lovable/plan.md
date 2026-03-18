

## Bug: Conteggio rate pagate e importo pagato non si aggiornano

### Causa
In `RateationRowDetailsPro.tsx` riga 638-644, il componente `InstallmentPaymentActions` riceve `onReload={load}` e `onStatsReload={debouncedReloadStats}`, ma **non riceve `onReloadList`**. 

`InstallmentPaymentActions` chiama `onReloadList?.()` dopo ogni pagamento (righe 86, 116, 268) per aggiornare la riga padre nella tabella principale. Siccome non viene passato, il numero di rate pagate e l'importo pagato nella riga di riepilogo restano invariati.

La prop `onDataChanged` del componente esiste ed e' pensata per notificare il padre, ma non viene invocata dopo il pagamento.

### Soluzione

**File: `src/features/rateations/components/RateationRowDetailsPro.tsx`** (riga 638-644)

Passare `onDataChanged` come `onReloadList` a `InstallmentPaymentActions`:

```diff
  <InstallmentPaymentActions
    rateationId={rateationId}
    installment={it}
    onReload={load}
+   onReloadList={onDataChanged}
    onStatsReload={debouncedReloadStats}
    disabled={!online || rateationInfo?.status === 'ESTINTA'}
  />
```

Questo fa si' che dopo un pagamento, `onReloadList` chiami `onDataChanged` che risale al componente padre (`RateationsTablePro`), aggiornando il conteggio rate pagate e l'importo pagato nella riga principale.

### Garanzia dati
- Nessuna modifica al database o alle API
- Solo collegamento di un callback gia' esistente ma non connesso

