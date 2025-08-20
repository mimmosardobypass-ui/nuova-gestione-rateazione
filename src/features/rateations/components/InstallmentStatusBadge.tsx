import { Badge } from "@/components/ui/badge";
import type { InstallmentUI } from "../types";

interface InstallmentStatusBadgeProps {
  installment: InstallmentUI;
}

export function InstallmentStatusBadge({ installment }: InstallmentStatusBadgeProps) {
  // Check for decayed status first
  if (installment.effective_status === 'decayed') {
    return <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-300">Non dovuta (decadenza)</Badge>;
  }

  if (!installment.is_paid) {
    const today = new Date();
    const dueDate = new Date(installment.due_date);
    const isOverdue = today > dueDate;

    if (isOverdue) {
      return <Badge variant="destructive">In ritardo</Badge>;
    } else {
      return <Badge variant="outline">Da pagare</Badge>;
    }
  }

  // Installment is paid - check payment mode
  if (installment.payment_mode === 'ravvedimento') {
    return <Badge variant="secondary" className="bg-purple-100 text-purple-800 border-purple-300">Pagata (Rav.)</Badge>;
  }

  if (installment.payment_mode === 'ordinary') {
    return <Badge variant="secondary">Pagata</Badge>;
  }

  // Fallback for legacy data - check if has ravvedimento amounts
  const hasRavvedimento = (installment.penalty_amount_cents && installment.penalty_amount_cents > 0) || 
                         (installment.interest_amount_cents && installment.interest_amount_cents > 0) ||
                         (installment.extra_interest_euro && installment.extra_interest_euro > 0) ||
                         (installment.extra_penalty_euro && installment.extra_penalty_euro > 0);

  if (hasRavvedimento) {
    return <Badge variant="secondary" className="bg-purple-100 text-purple-800 border-purple-300">Pagata (Rav.)</Badge>;
  }

  return <Badge variant="secondary">Pagata</Badge>;
}