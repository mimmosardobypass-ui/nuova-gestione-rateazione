import type { InstallmentUI } from '../types';

/**
 * Single source of truth for installment payment status
 * CRITICAL: Only check is_paid - never use paid_at/paid_date for payment status
 */
export const isInstallmentPaid = (installment: InstallmentUI): boolean => {
  return installment?.is_paid === true;
};

/**
 * Get payment date only if installment is actually paid
 * Used for display purposes only, never for payment status determination
 */
export const getPaymentDate = (installment: InstallmentUI): string | null => {
  if (!isInstallmentPaid(installment)) return null;
  return installment.paid_date || installment.paid_at || null;
};

/**
 * Determine effective status of an installment
 */
export const getEffectiveStatus = (installment: InstallmentUI): 'paid' | 'paid_ravv' | 'overdue' | 'open' | 'decayed' => {
  // Check for decayed status first (from rateation decadence)
  if (installment.rateation_status === 'decaduta' && !isInstallmentPaid(installment)) {
    return 'decayed';
  }
  
  // If paid, determine if it was ravvedimento
  if (isInstallmentPaid(installment)) {
    const isRavvedimento = installment.payment_mode === 'ravvedimento' ||
                          (installment.penalty_amount_cents || 0) > 0 ||
                          (installment.interest_amount_cents || 0) > 0 ||
                          (installment.extra_interest_euro || 0) > 0 ||
                          (installment.extra_penalty_euro || 0) > 0;
    return isRavvedimento ? 'paid_ravv' : 'paid';
  }
  
  // For unpaid installments, check if overdue
  if (!installment.due_date) return 'open';
  const today = new Date();
  const dueDate = new Date(installment.due_date);
  return today > dueDate ? 'overdue' : 'open';
};

/**
 * Check if an installment is overdue (unpaid and past due date)
 */
export const isInstallmentOverdue = (installment: InstallmentUI): boolean => {
  if (isInstallmentPaid(installment)) return false;
  if (!installment.due_date) return false;
  
  const today = new Date();
  const dueDate = new Date(installment.due_date);
  return today > dueDate;
};

/**
 * Get days past due for an overdue installment
 */
export const getDaysOverdue = (installment: InstallmentUI): number => {
  if (!isInstallmentOverdue(installment)) return 0;
  
  const today = new Date();
  const dueDate = new Date(installment.due_date);
  return Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
};

/**
 * Get total amount paid including ravvedimento additions
 * Only relevant for paid installments
 */
export const getTotalPaidAmount = (installment: InstallmentUI): number => {
  if (!isInstallmentPaid(installment)) return 0;
  
  // Use paid_total_cents if available, otherwise calculate
  if (installment.paid_total_cents) {
    return installment.paid_total_cents / 100;
  }
  
  const principal = installment.amount || 0;
  const interest = installment.extra_interest_euro || 0;
  const penalty = installment.extra_penalty_euro || 0;
  
  return principal + interest + penalty;
};

/**
 * Format payment status for display
 */
export const formatPaymentStatus = (installment: InstallmentUI): { text: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } => {
  const status = getEffectiveStatus(installment);
  
  switch (status) {
    case 'paid':
      return { text: 'Pagata', variant: 'default' };
    case 'paid_ravv':
      return { text: 'Pagata (Rav.)', variant: 'default' };
    case 'overdue':
      return { text: 'In ritardo', variant: 'destructive' };
    case 'decayed':
      return { text: 'Non dovuta (decadenza)', variant: 'destructive' };
    case 'open':
    default:
      return { text: 'Da pagare', variant: 'secondary' };
  }
};