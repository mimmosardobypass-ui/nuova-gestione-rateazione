

## Piano: Rimuovere data pre-compilata dalle rate non pagate

### Problema
Per le rate "In ritardo" e "Da pagare", il date picker mostra la data odierna (10/02/2026) pre-compilata. L'utente vuole vedere solo il placeholder "Paga (ordinario)" con l'icona calendario, senza alcuna data pre-selezionata.

### Causa
In `InstallmentPaymentActions.tsx`, riga 44-46, lo stato `selectedDate` viene inizializzato a `new Date()` per le rate non pagate, causando la visualizzazione della data odierna.

### Modifica: `src/features/rateations/components/InstallmentPaymentActions.tsx`

**Cosa cambia:**
- Lo stato `selectedDate` partira' come `undefined` per le rate non pagate (invece di `new Date()`)
- Il bottone mostrera' solo "Paga (ordinario)" con l'icona calendario
- Quando l'utente seleziona una data dal calendario, il pagamento viene registrato normalmente
- Per le rate gia' pagate, nessun cambiamento: continuano a mostrare la data di pagamento

**Dettaglio tecnico:**

```diff
- const [selectedDate, setSelectedDate] = useState<Date | undefined>(
-   getPaymentDate(installment) ? new Date(getPaymentDate(installment)!) : new Date()
- );
+ const [selectedDate, setSelectedDate] = useState<Date | undefined>(
+   getPaymentDate(installment) ? new Date(getPaymentDate(installment)!) : undefined
+ );
```

### Sicurezza dati
- I dati esistenti (rate gia' pagate) non vengono toccati: la loro `paid_at` resta invariata nel database
- La modifica e' solo visuale sul componente UI: cambia solo il valore iniziale dello stato React
- Il salvataggio avviene solo quando l'utente seleziona esplicitamente una data dal calendario
- Nessuna query di UPDATE viene eseguita, nessun dato viene sovrascritto

### File da modificare
- `src/features/rateations/components/InstallmentPaymentActions.tsx` (1 riga)

