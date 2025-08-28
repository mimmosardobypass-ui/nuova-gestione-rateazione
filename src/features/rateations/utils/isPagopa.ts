import { RateationRow } from '../types';

/**
 * Helper unificato per rilevare piani PagoPA in modo tollerante
 * Controlla sia il flag is_pagopa che il campo tipo (stringa)
 */
export const isPagoPAPlan = (row: Pick<RateationRow, 'is_pagopa' | 'tipo'>) => {
  return row.is_pagopa === true || (row.tipo ?? '').toUpperCase().includes('PAGOPA');
};