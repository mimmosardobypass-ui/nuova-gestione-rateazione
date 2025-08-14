import * as React from "react";
import { Badge } from "@/components/ui/badge";

export type Installment = {
  seq: number;
  amount: number;
  due_date: string | null;
  is_paid: boolean;
  paid_at?: string | null;
  canceled_at?: string | null;
  postponed?: boolean;
  late_days?: number;
};

export type InstallmentStatus =
  | "paid"
  | "overdue"
  | "due_soon"
  | "unpaid"
  | "cancelled";

export function getInstallmentStatus(
  i: Installment,
  today = new Date()
): InstallmentStatus {
  if (i.canceled_at) return "cancelled";
  if (i.is_paid) return "paid";
  if (!i.due_date) return "unpaid";

  const d = new Date(i.due_date);
  d.setHours(0, 0, 0, 0);
  const t = new Date(today);
  t.setHours(0, 0, 0, 0);

  if (d < t) return "overdue";

  const soon = new Date(t);
  soon.setDate(soon.getDate() + 7);
  if (d <= soon) return "due_soon";

  return "unpaid";
}

export function StatusBadge({ status }: { status: InstallmentStatus }) {
  const map: Record<
    InstallmentStatus,
    { text: string; variant?: React.ComponentProps<typeof Badge>["variant"] }
  > = {
    paid:      { text: "Pagata",      variant: "secondary" },
    overdue:   { text: "In ritardo",  variant: "destructive" },
    due_soon:  { text: "In scadenza", variant: "outline" },
    unpaid:    { text: "Da pagare",   variant: "outline" },
    cancelled: { text: "Annullata",   variant: "secondary" },
  };

  const { text, variant } = map[status];
  return <Badge variant={variant}>{text}</Badge>;
}