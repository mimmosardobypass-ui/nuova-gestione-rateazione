import { z } from "zod";

export const RateationListRowSchema = z.object({
  id: z.number(),
  owner_uid: z.string().optional(),
  number: z.string().nullable().optional(),
  tipo: z.string().nullable().optional(),
  taxpayer_name: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  is_pagopa: z.boolean().nullable().optional(),
  is_f24: z.boolean().nullable().optional(),
  is_quater: z.boolean().nullable().optional(),
  type_id: z.number().nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),

  // Monetary fields (canonical in cents from v_rateations_list_ui)
  total_amount_cents: z.number().nonnegative(),
  paid_amount_cents: z.number().nonnegative(),
  residual_effective_cents: z.number().nonnegative(),
  overdue_effective_cents: z.number().nonnegative(),

  // Installment counters
  installments_total: z.number().int().nonnegative(),
  installments_paid: z.number().int().nonnegative(),
  installments_overdue_today: z.number().int().nonnegative().optional(),

  // Quater fields (in cents)
  original_total_due_cents: z.number().nullable().optional(),
  quater_total_due_cents: z.number().nullable().optional(),
  
  // RQ allocation fields for quota-based saving calculation
  allocated_residual_cents: z.number().nullable().optional(),
  rq_total_at_link_cents: z.number().nullable().optional(),
});

export type RateationListRow = z.infer<typeof RateationListRowSchema>;
export const RateationListRowsSchema = z.array(RateationListRowSchema);