# Dashboard Statistiche

## Accesso
Navigare a `/statistiche` (route protetta, richiede autenticazione).

## Filtri Globali
I filtri sono **persistenti** in LocalStorage per 30 giorni (`stats:filters:v1`):

- **Periodo**: Data inizio e fine (default: anno corrente)
- **Tipologia**: Selezione multipla tra F24, PagoPA, Rottamazione Quater, Riam. Quater, Altro
- **Stato**: Selezione multipla tra attiva, INTERROTTA, completata, decaduta
- **Contribuente**: Ricerca testuale per nome contribuente
- **Solo mie pratiche**: Toggle per filtrare solo le pratiche dell'utente corrente

### Azioni Filtri
- **Applica Filtri**: Applica i filtri selezionati e ricarica i dati
- **Reset**: Ripristina i filtri ai valori di default (anno corrente, tutti i tipi, tutti gli stati)

## KPI (Key Performance Indicators)

### Residuo Totale
Somma degli importi residui (non pagati) di tutte le rateazioni attive, calcolato sui dati filtrati.

### Pagato Totale
Somma degli importi già pagati di tutte le rateazioni, calcolato sui dati filtrati.

### In Ritardo
Somma degli importi delle rate scadute e non pagate, calcolato sui dati filtrati.

### Risparmio RQ
Differenza tra il debito originario e l'importo ridotto tramite Rottamazione Quater. 
Questo valore è calcolato globalmente (non filtrato) dalla vista `v_quater_saving_per_user`.

## Grafici

### Importi per Tipologia (Barre)
Mostra per ogni tipologia (F24, PagoPA, ecc.) gli importi totali, pagati e residui.

### Distribuzione per Stato (Torta)
Mostra la distribuzione percentuale degli importi totali per stato (attiva, INTERROTTA, ecc.).

### Cash Flow Mensile (Linea)
Confronto tra importi dovuti e pagati per ogni mese nel periodo selezionato.

## Tabelle

### Per Tipologia
Dettaglio numerico per tipologia: conteggio, totale, pagato, residuo, in ritardo.

### Per Stato
Dettaglio numerico per stato: conteggio, totale, pagato, residuo, in ritardo.

### Top Contribuenti
Primi 50 contribuenti ordinati per residuo decrescente, con dettaglio importi.

### Cashflow Mensile
Dettaglio mensile: numero rate, importi dovuti, pagati, non pagati, in ritardo.

## Export

### Excel (.xlsx)
Genera un file Excel con 5 fogli:
- **Per_tipologia**: Dati aggregati per tipo
- **Per_stato**: Dati aggregati per stato
- **Per_contribuente**: Top 50 contribuenti
- **Cashflow_mensile**: Dati mensili
- **Risparmi_RQ**: KPI riassuntivi

Ogni foglio include un'intestazione con periodo e filtri applicati.

### PDF
Genera un PDF multipagina con:
- Pagina 1: KPI e grafici principali
- Pagine successive: Tabelle dettagliate (per tipologia, stato, contribuenti)
- Footer: Data/ora generazione e numero pagina

**Nota**: Nessun logo è incluso negli export.

## Persistenza Layout
Lo stato "collapsed/expanded" delle sezioni (KPI, Grafici, Tabelle) è salvato in LocalStorage (`stats:layout:v1`) per 30 giorni.

## Architettura RPC Stats v2.0

### ⚠️ Breaking Change: Periodo di Filtro
**Prima (v1.0):** Filtro su `rateations.created_at`  
**Ora (v2.0):** Filtro su `installments.due_date`

**Perché?**
- Una rateazione creata a settembre 2025 può avere rate da marzo 2025 a febbraio 2032
- Filtrare su `created_at` la escludeva dai periodi 2024, 2026-2032
- Filtrare su `due_date` garantisce visibilità in tutti i periodi rilevanti

### Vista Canonica: `v_rateation_type_label`
Priorità mapping:
1. **PAGOPA** (prioritario su is_f24)
2. **F24**
3. **Rottamazione/Riammissione Quater**
4. **ALTRO**

### Performance
- Una sola chiamata RPC (`get_filtered_stats`) per caricare tutti i dati
- Dati in cents lato DB, convertiti in EUR lato UI
- Nessun N+1 query
- Risparmio RQ caricato separatamente da `v_quater_saving_per_user`
- Nuovo indice: `idx_installments_rateation_due` su `(rateation_id, due_date)`
- Tutte le RPC ora usano questo indice per il filtro periodo

## Palette Colori

### Tipologie
- F24: `#e03131`
- PagoPA: `#2f6ee5`
- Rottamazione Quater: `#2b8a3e`
- Riam. Quater: `#0ca678`
- Altro: `#868e96`

### Stati
- attiva: `#228be6`
- INTERROTTA: `#f08c00`
- completata: `#868e96`
- decaduta: `#fa5252`

### Cashflow
- Pagato: `#2b8a3e`
- Dovuto: `#e03131`

## Multi-tenant / RLS
Tutte le query rispettano automaticamente il `owner_uid` dell'utente autenticato tramite RLS di Supabase.

## Tecnologie
- React + TypeScript
- Recharts (grafici)
- xlsx (export Excel)
- jsPDF + jspdf-autotable (export PDF)
- LocalStorage (persistenza filtri/layout)
