// src/utils/stats-utils.ts
// ------------------------------------------------------------
// Normalizzazione sicura di RateationRow + KPI lordi/effettivi
// ------------------------------------------------------------

/** Valuta monetaria in EURO (number). Tutto ciò che esce da qui è in € */
type Euro = number;

/** Raw row (com'è nel tuo progetto). Manteniamo optional vari alias */
export interface RateationRow {
  // totali/paid/overdue/residual (possono essere in cents o in euro)
  total_amount_cents?: number;
  paid_amount_cents?: number;
  overdue_amount_cents?: number;
  residual_amount_cents?: number;

  total_amount?: Euro;       // alias possibile
  paid_amount?: Euro;        // alias possibile
  overdue_amount?: Euro;     // alias possibile
  residual_amount?: Euro;    // alias possibile

  // alias italiani già presenti in alcuni tuoi snippet
  importoTotale?: Euro;
  importoPagato?: Euro;
  importoRitardo?: Euro;
  residuoEffettivo?: Euro;

  // decadence / trasferimenti
  residual_at_decadence_cents?: number;
  transferred_amount_cents?: number;

  residual_at_decadence?: Euro;
  transferred_amount?: Euro;

  decadence_info?: {
    residual_at_decadence_cents?: number;
    transferred_amount_cents?: number;
    residual_at_decadence?: Euro;
    transferred_amount?: Euro;
  };

  // Rottamazione Quater
  is_quater?: boolean;
  original_total_due_cents?: number;
  quater_total_due_cents?: number;
  original_total_due?: Euro;        // Euro alias
  quater_total_due?: Euro;          // Euro alias

  // Link allocation fields for quota-based KPI calculation
  allocated_residual_cents?: number;
  pagopa_residual_at_link_cents?: number;
  rq_total_at_link_cents?: number;

  // status (tanti formati possibili nella tua app)
  status?: string | null;
}

/** Status normalizzati per la logica effettiva */
export type NormalizedStatus =
  | 'ATTIVA'
  | 'DECADUTA'
  | 'ESTINTA'
  | 'ARCHIVIATA'
  | 'SCONOSCIUTA';

/** Riga normalizzata in euro + status coerente */
export interface NormRow {
  status: NormalizedStatus;
  totalDue: Euro;        // totale dovuto lordo (euro)
  totalPaid: Euro;       // totale pagato (euro)
  overdue: Euro;         // in ritardo "lordo" base (euro)
  residualEffective: Euro; // residuo effettivo della pratica (se disponibile)
  residualAtDecadence: Euro; // residuo alla decadenza (se esiste)
  transferredAmount: Euro;   // importo già trasferito (se esiste)
  // Quater
  isQuater: boolean;
  originalTotalDue: Euro;
  quaterTotalDue: Euro;
}

/* ----------------- Helpers di normalizzazione ----------------- */

/** Prende la prima cifra disponibile tra vari alias in EURO o in *_cents */
function pickMoneyEUR(
  row: RateationRow,
  euroFields: (keyof RateationRow)[],
  centFields: (keyof RateationRow)[] = []
): Euro {
  for (const f of euroFields) {
    const v = row[f];
    if (typeof v === 'number' && !Number.isNaN(v)) return v;
  }
  for (const f of centFields) {
    const v = row[f];
    if (typeof v === 'number' && !Number.isNaN(v)) return v / 100;
  }
  return 0;
}

/** Cerca valori nell'oggetto principale o dentro decadence_info */
function pickDecadenceEUR(
  row: RateationRow,
  euroFieldsTop: (keyof RateationRow)[],
  centFieldsTop: (keyof RateationRow)[],
  euroFieldsNested: (keyof NonNullable<RateationRow['decadence_info']>)[] = [],
  centFieldsNested: (keyof NonNullable<RateationRow['decadence_info']>)[] = []
): Euro {
  // top-level
  const top = pickMoneyEUR(row, euroFieldsTop, centFieldsTop);
  if (top !== 0) return top;

  // nested
  const d = row.decadence_info;
  if (d) {
    // euro nested
    for (const f of euroFieldsNested) {
      const v = d[f];
      if (typeof v === 'number' && !Number.isNaN(v)) return v;
    }
    // cents nested
    for (const f of centFieldsNested) {
      const v = d[f];
      if (typeof v === 'number' && !Number.isNaN(v)) return v / 100;
    }
  }
  return 0;
}

/** Normalizza gli status più comuni nella tua base dati */
export function normalizeStatus(raw?: string | null): NormalizedStatus {
  const s = (raw || '').trim().toUpperCase();

  if (!s) return 'SCONOSCIUTA';

  // varianti tipiche viste nei tuoi esempi/chat:
  if (['ATTIVA', 'ACTIVE'].includes(s)) return 'ATTIVA';
  if (['DECADUTA', 'DECADED', 'DECADENZA'].includes(s)) return 'DECADUTA';
  if (['ESTINTA', 'CLOSED', 'CANCELLED', 'ESTINTO', 'ESTINTE'].includes(s)) return 'ESTINTA';
  if (['ARCHIVIATA', 'ARCHIVED'].includes(s)) return 'ARCHIVIATA';

  // alcune basi usano "DECADUTA" vs "ESTINTA" in modo intercambiabile:
  if (s.includes('DECAD')) return 'DECADUTA';
  if (s.includes('ESTINT')) return 'ESTINTA';
  if (s.includes('ARCHIV')) return 'ARCHIVIATA';
  if (s.includes('ATTIV')) return 'ATTIVA';

  return 'SCONOSCIUTA';
}

/** Converte una riga raw in NormRow (tutti importi in €) */
export function normalizeRow(row: RateationRow): NormRow {
  const totalDue = pickMoneyEUR(
    row,
    ['total_amount', 'importoTotale'],
    ['total_amount_cents']
  );

  const totalPaid = pickMoneyEUR(
    row,
    ['paid_amount', 'importoPagato'],
    ['paid_amount_cents']
  );

  const overdue = pickMoneyEUR(
    row,
    ['overdue_amount', 'importoRitardo'],
    ['overdue_amount_cents']
  );

  const residualEffective = pickMoneyEUR(
    row,
    ['residual_amount', 'residuoEffettivo'],
    ['residual_amount_cents']
  );

  const residualAtDecadence = pickDecadenceEUR(
    row,
    ['residual_at_decadence'],
    ['residual_at_decadence_cents'],
    ['residual_at_decadence'],
    ['residual_at_decadence_cents']
  );

  const transferredAmount = pickDecadenceEUR(
    row,
    ['transferred_amount'],
    ['transferred_amount_cents'],
    ['transferred_amount'],
    ['transferred_amount_cents']
  );

  const originalTotalDue = pickMoneyEUR(
    row,
    ['original_total_due'],             // Euro alias
    ['original_total_due_cents']        // Cents field
  );

  const quaterTotalDue = pickMoneyEUR(
    row,
    ['quater_total_due'],               // Euro alias  
    ['quater_total_due_cents']          // Cents field
  );

  return {
    status: normalizeStatus(row.status),
    totalDue,
    totalPaid,
    overdue,
    residualEffective,
    residualAtDecadence,
    transferredAmount,
    isQuater: !!row.is_quater,
    originalTotalDue,
    quaterTotalDue,
  };
}

/* ---------------------- KPI (EURO) ---------------------- */

export type KpiGross = {
  totalDueGross: Euro;
  totalPaidGross: Euro;
  residualGross: Euro;
  overdueGross: Euro;
};

export type KpiEffective = {
  residualEffective: Euro;
  overdueEffective: Euro;
  decadutoNet: Euro;
  commitmentsTotal: Euro;
};

export type QuaterKpis = {
  quaterSaving: Euro;
};

/** Utility: somma con protezione NaN */
const add = (a: number, b: number) => (a || 0) + (b || 0);

/** KPI LORDI = quadratura base sul dataset selezionato */
export function calcGrossKpis(rows: RateationRow[]): KpiGross {
  let totalDueGross = 0;
  let totalPaidGross = 0;
  let overdueGross = 0;

  rows.forEach((raw) => {
    const r = normalizeRow(raw);
    totalDueGross = add(totalDueGross, r.totalDue);
    totalPaidGross = add(totalPaidGross, r.totalPaid);
    overdueGross = add(overdueGross, r.overdue);
  });

  return {
    totalDueGross,
    totalPaidGross,
    residualGross: totalDueGross - totalPaidGross,
    overdueGross,
  };
}

/** KPI EFFETTIVI = gestione reale (esclude estinte/decadute dal residuo eff.) */
export function calcEffectiveKpis(rows: RateationRow[]): KpiEffective {
  const norm = rows.map(normalizeRow);

  const activeRows = norm.filter((r) => r.status !== 'ESTINTA' && r.status !== 'DECADUTA');
  const decaduteRows = norm.filter((r) => r.status === 'DECADUTA');

  // residuo effettivo: somma residui delle pratiche in gestione
  const residualEffective = activeRows.reduce((sum, r) => add(sum, r.residualEffective), 0);

  // in ritardo effettivo: per ora base = overdue delle attive
  // (integra qui la tua logica di tolleranza/skip quando pronta)
  const overdueEffective = activeRows.reduce((sum, r) => add(sum, r.overdue), 0);

  // decaduto netto: residuo alla decadenza - trasferito
  const decadutoNet = decaduteRows.reduce((sum, r) => {
    const net = Math.max(0, (r.residualAtDecadence || 0) - (r.transferredAmount || 0));
    return add(sum, net);
  }, 0);

  const commitmentsTotal = residualEffective + decadutoNet;

  return { residualEffective, overdueEffective, decadutoNet, commitmentsTotal };
}

/** KPI Rottamazione Quater (valore positivo = risparmio) */
export function calcQuaterSaving(rows: RateationRow[]): QuaterKpis {
  const norm = rows.map(normalizeRow).filter((r) => r.isQuater);

  const quaterSaving = norm.reduce((sum, r) => {
    const diff = Math.max(0, (r.originalTotalDue || 0) - (r.quaterTotalDue || 0));
    return add(sum, diff);
  }, 0);

  return { quaterSaving };
}

/** KPI Rottamazione Quater basato sui collegamenti con quotas (prevenire doppi conteggi) */
export function calcQuaterSavingFromLinks(rows: RateationRow[]): QuaterKpis {
  const quaterRows = rows.filter(r => r.is_quater);
  
  const total = quaterRows.reduce((sum, quaterRow) => {
    // Use allocated quota instead of full residual to prevent double-counting
    const allocatedEUR = (quaterRow.allocated_residual_cents ?? 0) / 100;
    const rqTotalEUR = (quaterRow.rq_total_at_link_cents ?? quaterRow.quater_total_due_cents ?? 0) / 100;
    const saving = Math.max(0, allocatedEUR - rqTotalEUR);
    
    return sum + saving;
  }, 0);

  return { quaterSaving: total };
}

/**
 * Formattazione tooltip per KPI
 */
export const KPI_TOOLTIPS = {
  residualEffective: "Quota residua escludendo le pratiche decadute.",
  overdueEffective: "Rate scadute non pagate dopo tolleranza e regole di skip.",
  decadutoNet: "Importo residuo delle pratiche decadute da trasferire.",
  commitmentsTotal: "Somma di Residuo effettivo e Saldo decaduto.",
  quaterSaving: "Risparmio calcolato utilizzando le quote allocate dai collegamenti PagoPA→RQ per evitare doppi conteggi.",
  residualGross: "Dovuto meno pagato, include anche pratiche decadute.",
  totalDueGross: "Importo totale dovuto di tutte le rateazioni.",
  totalPaidGross: "Importo totale pagato di tutte le rateazioni.",
  overdueGross: "Rate scadute non pagate senza tolleranze.",
} as const;

/* ---------------------- Consigli d'uso ----------------------
 * - Passa sempre lo STESSO dataset filtrato (stessi filtri) sia alla Home
 *   che alla "Vedi Rateazioni" per evitare discrepanze.
 * - Tutti gli importi in uscita sono in EURO.
 * - Se in futuro cambi i nomi dei campi, basta aggiornare gli alias in
 *   `pickMoneyEUR`/`pickDecadenceEUR` senza toccare il resto.
 * ------------------------------------------------------------ */