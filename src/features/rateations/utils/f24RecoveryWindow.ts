/**
 * F24 Recovery Window Calculation Utilities
 * 
 * Unified logic for calculating F24 recovery window status:
 * - Find next unpaid due date
 * - Calculate days remaining
 * - Determine risk level
 */

export interface F24RecoveryInfo {
  overdueCount: number; // Rate scadute non pagate (due_date < today)
  unpaidCount: number; // Tutte le rate future non pagate (due_date >= today)
  nextDueDate: string | null;
  daysRemaining: number;
  isAtRisk: boolean; // true if daysRemaining <= 20
}

export interface InstallmentLike {
  is_paid?: boolean;
  paid_at?: string | null;
  paid_date?: string | null;
  due_date: string;
}

/**
 * Calculate F24 recovery window status from installments
 */
export function calculateF24RecoveryWindow(
  installments: InstallmentLike[]
): F24RecoveryInfo {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset to midnight for accurate day calculation
  
  // Find all unpaid installments
  const allUnpaid = installments.filter(inst => {
    // Check if paid (support both is_paid and paid_at/paid_date)
    const isPaid = inst.is_paid || !!inst.paid_at || !!inst.paid_date;
    return !isPaid;
  });
  
  // Separate overdue (< today) from future unpaid (>= today)
  const overdueInstallments = allUnpaid.filter(inst => {
    const dueDate = new Date(inst.due_date);
    return dueDate < today;
  });
  
  const unpaidFuture = allUnpaid.filter(inst => {
    const dueDate = new Date(inst.due_date);
    return dueDate >= today;
  });
  
  if (unpaidFuture.length === 0) {
    return {
      overdueCount: overdueInstallments.length,
      unpaidCount: 0,
      nextDueDate: null,
      daysRemaining: Infinity,
      isAtRisk: false
    };
  }
  
  // Find MIN(due_date) - la prossima scadenza
  const nextDueDateMs = Math.min(
    ...unpaidFuture.map(i => new Date(i.due_date).getTime())
  );
  const nextDueDate = new Date(nextDueDateMs);
  
  // Calculate days remaining (ceiling to avoid showing "0 giorni" when still same day)
  const diffMs = nextDueDateMs - today.getTime();
  const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  
  return {
    overdueCount: overdueInstallments.length,
    unpaidCount: unpaidFuture.length,
    nextDueDate: nextDueDate.toISOString(),
    daysRemaining: Math.max(0, daysRemaining), // Clamp to 0 minimum
    isAtRisk: daysRemaining <= 20
  };
}

/**
 * Get badge color variant based on days remaining
 */
export function getRecoveryBadgeVariant(daysRemaining: number): 'success' | 'warning' | 'destructive' | 'secondary' {
  if (daysRemaining > 20) return 'success';
  if (daysRemaining >= 10) return 'warning';
  if (daysRemaining > 0) return 'destructive';
  return 'secondary'; // Overdue
}

/**
 * Get CSS classes for badge color based on days remaining
 */
export function getRecoveryBadgeClasses(daysRemaining: number): string {
  if (daysRemaining > 20) return 'bg-green-50 text-green-700 border-green-200';
  if (daysRemaining >= 10) return 'bg-yellow-50 text-yellow-700 border-yellow-200';
  if (daysRemaining > 0) return 'bg-red-50 text-red-700 border-red-200';
  return 'bg-gray-50 text-gray-700 border-gray-200'; // Overdue
}
