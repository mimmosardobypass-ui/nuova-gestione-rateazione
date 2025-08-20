import { Badge } from "@/components/ui/badge";
import type { InstallmentUI } from "../types";
import { formatPaymentStatus } from "../lib/installmentState";

interface InstallmentStatusBadgeProps {
  installment: InstallmentUI;
}

export function InstallmentStatusBadge({ installment }: InstallmentStatusBadgeProps) {
  const { text, variant } = formatPaymentStatus(installment);
  return <Badge variant={variant}>{text}</Badge>;
}