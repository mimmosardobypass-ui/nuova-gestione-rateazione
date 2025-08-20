import type { InstallmentUI } from "../types";

/**
 * Consistent payment detection utility for installments
 * Checks all possible payment indicators to determine if an installment is paid
 */
export function isInstallmentPaid(installment: InstallmentUI): boolean {
  return Boolean(
    installment.is_paid || 
    installment.paid_at || 
    installment.paid_date ||
    installment.effective_status === 'paid'
  );
}

/**
 * Get the effective payment date for an installment
 * Returns the first available payment date from various sources
 */
export function getPaymentDate(installment: InstallmentUI): string | null {
  return installment.paid_date || installment.paid_at || null;
}

/**
 * Check if an installment is overdue (unpaid and past due date)
 */
export function isInstallmentOverdue(installment: InstallmentUI): boolean {
  if (isInstallmentPaid(installment)) return false;
  if (!installment.due_date) return false;
  
  const today = new Date();
  const dueDate = new Date(installment.due_date);
  return today > dueDate;
}

/**
 * Get days past due for an overdue installment
 */
export function getDaysOverdue(installment: InstallmentUI): number {
  if (!isInstallmentOverdue(installment)) return 0;
  
  const today = new Date();
  const dueDate = new Date(installment.due_date);
  return Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
}