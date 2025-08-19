import { Badge } from "@/components/ui/badge";
import type { InstallmentUI } from "../types";

interface InstallmentStatusBadgeProps {
  installment: InstallmentUI;
}

export function InstallmentStatusBadge({ installment }: InstallmentStatusBadgeProps) {
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

  // Installment is paid - check payment mode and late status
  const isLatePayment = installment.late_days && installment.late_days > 0;
  const hasRavvedimento = installment.penalty_amount_cents > 0 || installment.interest_amount_cents > 0;

  if (isLatePayment && !hasRavvedimento) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="secondary">Pagata</Badge>
        <Badge variant="outline" className="text-yellow-600 border-yellow-600">
          Pagata in ritardo (senza ravvedimento)
        </Badge>
      </div>
    );
  }

  if (hasRavvedimento) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="secondary">Pagata</Badge>
        <Badge variant="outline" className="text-purple-600 border-purple-600">
          Con ravvedimento
        </Badge>
      </div>
    );
  }

  return <Badge variant="secondary">Pagata</Badge>;
}