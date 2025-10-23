/**
 * Configurazione centralizzata per alert di rischio decadenza
 * 
 * Modifica questo file per cambiare:
 * - Soglie di giorni per alert
 * - Numero di rate/salti per avvisi
 * - Messaggi visualizzati
 */

export type AlertLevel = 'danger' | 'warning' | 'caution' | 'success';
export type AlertType = 'f24' | 'pagopa';

export interface AlertMessage {
  title: (count: number) => string;
  description: (details: AlertDetails) => string;
}

export interface AlertDetails {
  minDaysRemaining: number;
  avgDaysRemaining: number;
  maxDaysRemaining: number;
  count: number;
  skipRemaining?: number;
}

export interface AlertConfig {
  f24: {
    daysThreshold: number;
    overdueThreshold: number;
    urgencyLevels: {
      danger: number;
      warning: number;
      caution: number;
    };
    messages: Record<AlertLevel, AlertMessage>;
  };
  pagopa: {
    maxSkips: number;
    preWarningSkips: number;
    daysThreshold: number;
    urgencyLevels: {
      danger: number;
      warning: number;
      caution: number;
    };
    messages: Record<AlertLevel, AlertMessage>;
  };
}

/**
 * Configurazione di default - MODIFICA QUI per cambiare soglie
 */
export const ALERT_CONFIG: AlertConfig = {
  f24: {
    daysThreshold: 20,        // Alert se prossima scadenza entro 20 giorni
    overdueThreshold: 1,      // Alert se almeno 1 rata scaduta
    urgencyLevels: {
      danger: 7,              // Rosso se ≤7 giorni
      warning: 15,            // Arancione se 8-15 giorni
      caution: 30,            // Giallo se 16-30 giorni
    },
    messages: {
      danger: {
        title: (count) => `${count} Rateazion${count === 1 ? 'e' : 'i'} F24 in URGENZA IMMEDIATA`,
        description: (details) =>
          `Rate scadute non pagate con prossima scadenza tra ${details.avgDaysRemaining} giorni in media. Rischio decadenza imminente!`,
      },
      warning: {
        title: (count) => `${count} Rateazion${count === 1 ? 'e' : 'i'} F24 richied${count === 1 ? 'e' : 'ono'} attenzione`,
        description: (details) =>
          `Rate scadute non pagate. Prossima scadenza tra ${details.avgDaysRemaining} giorni in media. Monitora attentamente.`,
      },
      caution: {
        title: (count) => `${count} Rateazion${count === 1 ? 'e' : 'i'} F24 da monitorare`,
        description: (details) =>
          `Rate in ritardo. Prossima scadenza tra ${details.avgDaysRemaining} giorni in media.`,
      },
      success: {
        title: () => 'Nessuna rateazione F24 a rischio',
        description: () => 'Tutte le rateazioni F24 sono in regola o hanno tempo sufficiente.',
      },
    },
  },
  pagopa: {
    maxSkips: 8,              // Limite massimo salti
    preWarningSkips: 7,       // Alert a 7 salti (1 di margine)
    daysThreshold: 30,        // Alert se prossima scadenza entro 30 giorni
    urgencyLevels: {
      danger: 7,
      warning: 15,
      caution: 30,
    },
    messages: {
      danger: {
        title: (count) => `${count} Rateazion${count === 1 ? 'e' : 'i'} PagoPA in URGENZA`,
        description: (details) =>
          `${details.skipRemaining ?? 0} salt${(details.skipRemaining ?? 0) === 1 ? 'o' : 'i'} rimast${(details.skipRemaining ?? 0) === 1 ? 'o' : 'i'} su ${ALERT_CONFIG.pagopa.maxSkips}. Prossima scadenza tra ${details.avgDaysRemaining} giorni in media. Rischio decadenza immediato!`,
      },
      warning: {
        title: (count) => `${count} Rateazion${count === 1 ? 'e' : 'i'} PagoPA necessita${count === 1 ? '' : 'no'} attenzione`,
        description: (details) =>
          `${details.skipRemaining ?? 0} salt${(details.skipRemaining ?? 0) === 1 ? 'o' : 'i'} rimast${(details.skipRemaining ?? 0) === 1 ? 'o' : 'i'} su ${ALERT_CONFIG.pagopa.maxSkips}. Prossima scadenza tra ${details.avgDaysRemaining} giorni in media.`,
      },
      caution: {
        title: (count) => `${count} Rateazion${count === 1 ? 'e' : 'i'} PagoPA da monitorare`,
        description: (details) =>
          `${details.skipRemaining ?? 0} salt${(details.skipRemaining ?? 0) === 1 ? 'o' : 'i'} rimast${(details.skipRemaining ?? 0) === 1 ? 'o' : 'i'} su ${ALERT_CONFIG.pagopa.maxSkips}. Prossima scadenza tra ${details.avgDaysRemaining} giorni in media.`,
      },
      success: {
        title: () => 'Nessuna rateazione PagoPA a rischio',
        description: () => 'Tutte le rateazioni PagoPA sono in regola o hanno margine sufficiente.',
      },
    },
  },
};

/**
 * Determina il livello di alert basato sui giorni rimanenti
 */
export function getAlertLevel(daysRemaining: number, type: AlertType): AlertLevel {
  const config = ALERT_CONFIG[type];
  
  if (daysRemaining <= config.urgencyLevels.danger) return 'danger';
  if (daysRemaining <= config.urgencyLevels.warning) return 'warning';
  if (daysRemaining <= config.urgencyLevels.caution) return 'caution';
  return 'success';
}

/**
 * Calcola dettagli aggregati per messaggi dinamici
 */
export function calculateAlertDetails(
  items: Array<{ daysRemaining: number; skipRemaining?: number }>,
  type: AlertType
): AlertDetails {
  if (items.length === 0) {
    return {
      minDaysRemaining: 0,
      avgDaysRemaining: 0,
      maxDaysRemaining: 0,
      count: 0,
      skipRemaining: type === 'pagopa' ? ALERT_CONFIG.pagopa.maxSkips : undefined,
    };
  }

  const daysArray = items.map(item => item.daysRemaining);
  const minDays = Math.min(...daysArray);
  const maxDays = Math.max(...daysArray);
  const avgDays = Math.round(daysArray.reduce((sum, d) => sum + d, 0) / daysArray.length);

  // For PagoPA, calculate minimum skip remaining across all at-risk items
  let skipRemaining: number | undefined;
  if (type === 'pagopa') {
    const skipsArray = items.map(item => item.skipRemaining ?? ALERT_CONFIG.pagopa.maxSkips);
    skipRemaining = Math.min(...skipsArray);
  }

  return {
    minDaysRemaining: minDays,
    avgDaysRemaining: avgDays,
    maxDaysRemaining: maxDays,
    count: items.length,
    skipRemaining,
  };
}
