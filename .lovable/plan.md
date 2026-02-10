

## Piano: Fix visualizzazione data dopo aggiornamento

### Causa root
La data mostrata nel pulsante che apre il calendario (riga 205) usa `currentPaymentDate`, che deriva dalla prop `installment` tramite `useMemo`. Questa prop si aggiorna solo quando il componente padre riceve i nuovi dati dal server.

Lo stato `selectedDate` viene aggiornato ottimisticamente dopo il salvataggio (riga 78), ma non viene usato per mostrare la data nella sezione "rata pagata".

### Soluzione
Usare `selectedDate` al posto di `currentPaymentDate` per la visualizzazione della data nel trigger del popover. In questo modo, l'aggiornamento ottimistico si riflette immediatamente nella UI.

### Dettaglio tecnico

**File: `src/features/rateations/components/InstallmentPaymentActions.tsx`**

Riga 205 - Cambiare il testo del trigger:
```diff
- {format(new Date(currentPaymentDate), "dd/MM/yyyy", { locale: it })}
+ {format(selectedDate || new Date(currentPaymentDate), "dd/MM/yyyy", { locale: it })}
```

Riga 224 - Anche il confronto per disabilitare il bottone "Aggiorna" deve usare `selectedDate`:
```diff
- disabled={saving || !pendingEditDate || pendingEditDate.toDateString() === new Date(currentPaymentDate).toDateString()}
+ disabled={saving || !pendingEditDate || pendingEditDate.toDateString() === (selectedDate || new Date(currentPaymentDate)).toDateString()}
```

### Risultato
- Dopo il click su "Aggiorna", `selectedDate` viene aggiornato immediatamente (riga 78)
- La data visualizzata nel trigger usa `selectedDate`, quindi si aggiorna subito
- Quando il server risponde, il `useEffect` (riga 52-57) sincronizza di nuovo `selectedDate` con i dati reali

### File da modificare
- `src/features/rateations/components/InstallmentPaymentActions.tsx` (2 righe)
