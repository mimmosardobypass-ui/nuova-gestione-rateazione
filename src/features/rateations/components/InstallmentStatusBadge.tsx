import React from "react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import type { InstallmentUI } from "../types";

interface InstallmentStatusBadgeProps {
  installment: InstallmentUI;
}

export function InstallmentStatusBadge({ installment }: InstallmentStatusBadgeProps) {
  const getStatusInfo = () => {
    if (installment.is_paid) {
      return {
        variant: "secondary" as const,
        text: "Pagata",
        subtitle: installment.paid_at ? 
          `Pagata il ${format(new Date(installment.paid_at), "dd/MM/yyyy", { locale: it })}` : 
          "Pagata"
      };
    }

    if (installment.status === "late") {
      const lateDays = installment.late_days || 0;
      return {
        variant: "destructive" as const,
        text: "In ritardo",
        subtitle: lateDays > 0 ? `${lateDays} giorni di ritardo` : "In ritardo"
      };
    }

    return {
      variant: "outline" as const,
      text: "Da pagare",
      subtitle: installment.due_date ? 
        `Scade il ${format(new Date(installment.due_date), "dd/MM/yyyy", { locale: it })}` : 
        "Da pagare"
    };
  };

  const statusInfo = getStatusInfo();

  return (
    <div className="flex flex-col items-start gap-1">
      <Badge variant={statusInfo.variant}>
        {statusInfo.text}
      </Badge>
      {installment.postponed && (
        <Badge variant="outline" className="text-xs">
          Rimandata
        </Badge>
      )}
      <div className="text-xs text-muted-foreground">
        {statusInfo.subtitle}
      </div>
    </div>
  );
}