

## Piano: Aggiornamento automatico della data dopo modifica

### Problema
Dopo aver modificato la data di pagamento, la UI continua a mostrare la data vecchia perche':
1. `currentPaymentDate` dipende dalla prop `installment`, che viene aggiornata solo dopo il reload asincrono dal server
2. Nel frattempo, il componente mostra il valore precedente

### Soluzione
Aggiornare lo stato locale `selectedDate` immediatamente dopo la conferma del salvataggio (optimistic update), cosi' la data nuova appare subito senza attendere il reload dal server.

### Dettaglio tecnico

**File: `src/features/rateations/components/InstallmentPaymentActions.tsx`**

Nella funzione `handleMarkPaidOrdinary`, dopo la chiamata API riuscita, aggiungere l'aggiornamento dello stato locale:

```diff
  await markInstallmentPaidOrdinary({
    installmentId: installment.id.toString(),
    paidDate: isoDate
  });
  
+ // Optimistic update: aggiorna la data visualizzata immediatamente
+ setSelectedDate(date);
+
  toast({
    title: "Rata pagata",
    description: "Pagamento ordinario registrato"
  });
```

Inoltre, aggiungere un `useEffect` per sincronizzare `selectedDate` quando la prop `installment` viene aggiornata dal server (dopo il reload):

```typescript
// Sync selectedDate when installment prop updates from server
useEffect(() => {
  const payDate = getPaymentDate(installment);
  if (payDate) {
    setSelectedDate(new Date(payDate));
  }
}, [installment]);
```

### Risultato
- La data si aggiorna istantaneamente dopo la selezione (optimistic update)
- Quando il server risponde con i dati aggiornati, lo stato si sincronizza di nuovo (sicurezza)
- Nessun impatto sui dati esistenti, nessuna modifica al database

### File da modificare
- `src/features/rateations/components/InstallmentPaymentActions.tsx` (2 piccole aggiunte)

