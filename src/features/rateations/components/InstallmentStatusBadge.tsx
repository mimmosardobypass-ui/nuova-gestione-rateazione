import { Badge } from "@/components/ui/badge";
import type { InstallmentUI } from "../types";

interface InstallmentStatusBadgeProps {
  installment: InstallmentUI;
}

export function InstallmentStatusBadge({ installment }: InstallmentStatusBadgeProps) {
  // Priority: server-derived status from v_installments_effective view
  const eff = installment.effective_status;
  if (eff === 'decayed') return <Badge variant="destructive">Non dovuta (decadenza)</Badge>;
  if (eff === 'paid') {
    const isRavvedimento = installment.payment_mode === 'ravvedimento';
    return <Badge variant="default">Pagata{isRavvedimento ? ' (Rav.)' : ''}</Badge>;
  }
  if (eff === 'overdue') return <Badge variant="destructive">In ritardo</Badge>;
  if (eff === 'open') return <Badge variant="secondary">Da pagare</Badge>;

  // Fallback legacy (if eff not present)
  const isPaid = installment.is_paid || !!installment.paid_at || !!installment.paid_date;
  if (installment.rateation_status === 'decaduta' && !isPaid) {
    return <Badge variant="destructive">Non dovuta (decadenza)</Badge>;
  }
  if (isPaid) {
    const rav = installment.payment_mode === 'ravvedimento' ||
                (installment.penalty_amount_cents || 0) > 0 ||
                (installment.interest_amount_cents || 0) > 0 ||
                (installment.extra_interest_euro || 0) > 0 ||
                (installment.extra_penalty_euro || 0) > 0;
    return <Badge variant="default">Pagata{rav ? ' (Rav.)' : ''}</Badge>;
  }
  const today = new Date();
  const due = new Date(installment.due_date);
  return today > due
    ? <Badge variant="destructive">In ritardo</Badge>
    : <Badge variant="secondary">Da pagare</Badge>;
}