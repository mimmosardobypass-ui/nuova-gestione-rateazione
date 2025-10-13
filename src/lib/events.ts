/**
 * Global event system for coordinating data reload across components
 */

// Event names
export const RATEATION_CHANGED = 'rateation:changed';
export const RATEATION_DELETED = 'rateation:deleted';
export const RATEATION_CREATED = 'rateation:created';

// Event interfaces
export interface RateationDeletedDetail {
  id: number;
  number?: string;
}

export interface RateationChangedDetail {
  id?: number;
  action?: 'created' | 'updated' | 'deleted';
}

// Notify functions
export function notifyRateationChanged(detail?: RateationChangedDetail) {
  console.debug('[Events] Rateation changed:', detail);
  window.dispatchEvent(new CustomEvent(RATEATION_CHANGED, { detail }));
}

export function notifyRateationDeleted(id: number, number?: string) {
  console.debug('[Events] Rateation deleted:', { id, number });
  window.dispatchEvent(
    new CustomEvent(RATEATION_DELETED, { 
      detail: { id, number } satisfies RateationDeletedDetail 
    })
  );
}

export function notifyRateationCreated(id: number) {
  console.debug('[Events] Rateation created:', id);
  window.dispatchEvent(
    new CustomEvent(RATEATION_CHANGED, { 
      detail: { id, action: 'created' } satisfies RateationChangedDetail 
    })
  );
}
