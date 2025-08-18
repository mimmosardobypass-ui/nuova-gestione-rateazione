import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { formatEuro } from "@/lib/formatters";
import type { InstallmentUI } from "../types";

interface InstallmentStatusBadgeProps {
  installment: InstallmentUI;
}

export function InstallmentStatusBadge({ installment }: InstallmentStatusBadgeProps) {
  const getStatusInfo = () => {
    if (installment.is_paid) {
      const paidDate = installment.paid_at ? format(new Date(installment.paid_at), "dd/MM/yyyy", { locale: it }) : "N/A";
      const lateDays = installment.late_days || 0;
      const hasRav = (installment.paid_total_cents ?? 0) > 0;
      
      let subtitle = lateDays > 0 ? `Pagata il ${paidDate} — ${lateDays} gg ritardo` : `Pagata il ${paidDate}`;
      
      if (hasRav && installment.paid_total_cents) {
        const originalAmount = installment.amount || 0;
        const extraAmount = (installment.paid_total_cents / 100) - originalAmount;
        subtitle += ` • Totale: ${formatEuro(installment.paid_total_cents / 100)}`;
        if (extraAmount > 0) {
          subtitle += ` (${formatEuro(extraAmount)} extra)`;
        }
      }
      
      return {
        variant: "secondary" as const,
        text: hasRav ? "Pagata (Ravvedimento)" : "Pagata",
        subtitle
      };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (installment.due_date) {
      const dueDate = new Date(installment.due_date);
      dueDate.setHours(0, 0, 0, 0);
      
      if (dueDate < today) {
        const daysDiff = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        return {
          variant: "destructive" as const,
          text: "In ritardo",
          subtitle: `${daysDiff} giorni di ritardo`
        };
      }
    }

    const dueText = installment.due_date ? format(new Date(installment.due_date), "dd/MM/yyyy", { locale: it }) : "N/A";
    return {
      variant: "outline" as const,
      text: "Da pagare",
      subtitle: `Scade il ${dueText}`
    };
  };

  const { variant, text, subtitle } = getStatusInfo();

  return (
    <div className="flex flex-col items-end gap-1">
      <Badge variant={variant}>{text}</Badge>
      {installment.postponed && <Badge variant="outline" className="text-xs">Rimandata</Badge>}
      <div className="text-xs text-muted-foreground text-right">{subtitle}</div>
    </div>
  );
}