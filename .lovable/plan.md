
## Rimuovere la colonna duplicata "Pagata il"

### Garanzia sui dati
Questa modifica e' esclusivamente di presentazione (UI). Non tocca:
- Il database: le colonne `paid_date`, `paid_at`, `is_paid`, `paid_total_cents` restano invariate
- Le API: nessuna modifica a `markInstallmentPaidOrdinary`, `cancelInstallmentPayment`, ecc.
- La logica di business: `InstallmentPaymentActions` continua a mostrare la data di pagamento e a gestire modifiche/annullamenti

La colonna "Pagamento" gia' mostra la data di pagamento per le rate pagate (con possibilita' di modifica). La colonna "Pagata il" e' una copia statica ridondante.

### Modifica

**File: `src/features/rateations/components/RateationRowDetailsPro.tsx`**

1. Rimuovere l'header `<th>Pagata il</th>` (riga 605)
2. Rimuovere la cella dati corrispondente (righe 638-640):
   ```
   <td className="px-3 py-2">
     {safeDate(it?.paid_date)?.toLocaleDateString('it-IT') ?? '—'}
   </td>
   ```
3. Aggiornare eventuali `colSpan` nelle righe di errore/vuoto da 7 a 6

### Colonne risultanti
`#` | `Scadenza` | `Importo` | `Stato` | `Pagamento` | `Azioni`

### Nessun rischio di perdita dati
- I pagamenti sono salvati nel database e non vengono modificati
- La data resta visibile nella colonna "Pagamento" tramite `InstallmentPaymentActions`
- Il bottone "Aggiorna" e "Annulla pagamento" continuano a funzionare normalmente
