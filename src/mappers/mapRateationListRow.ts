import type { RateationListRow } from "@/schemas/RateationListRow.schema";
import type { RateationRow } from "@/features/rateations/types";

const centsToEur = (cents: number) => cents / 100;

/**
 * Centralized mapping from v_rateations_list_ui view to UI RateationRow
 * Ensures consistent monetary conversions and field mapping
 */
export function mapListRowToUI(r: RateationListRow): RateationRow {
  return {
    id: String(r.id),
    numero: r.number ?? "",
    tipo: r.tipo ?? "N/A",
    contribuente: r.taxpayer_name ?? "",

    // Monetary fields: cents → EUR (canonical from view)
    importoTotale: centsToEur(r.total_amount_cents),
    importoPagato: centsToEur(r.paid_amount_cents),
    importoRitardo: centsToEur(r.overdue_effective_cents),
    residuo: centsToEur(r.residual_effective_cents),
    residuoEffettivo: centsToEur(r.residual_effective_cents),

    // Installment counters and calculations
    rateTotali: r.installments_total,
    ratePagate: r.installments_paid,
    rateNonPagate: r.installments_total - r.installments_paid,
    rateInRitardo: r.installments_overdue_today ?? 0,

    // Status and flags
    status: (r.status as any) ?? "ATTIVA",
    is_pagopa: !!r.is_pagopa,
    is_f24: !!r.is_f24,
    is_quater: !!r.is_quater,

    // Database fields for compatibility
    created_at: r.created_at ?? undefined,
    updated_at: r.updated_at ?? undefined,
    type_id: Number(r.type_id || 0),
    type_name: r.tipo ?? "N/A",
    ratePaidLate: 0, // Not available in list view

    // Quater fields (cents → raw numbers for calculations)
    original_total_due_cents: Number(r.original_total_due_cents || 0),
    quater_total_due_cents: Number(r.quater_total_due_cents || 0),
    
    // Allocated residual cents for quota-based RQ calculations
    allocated_residual_cents: Number((r as any).allocated_residual_cents ?? 0),

    // PagoPA fields with safe defaults
    unpaid_overdue_today: Number(r.installments_overdue_today || 0),
    unpaid_due_today: 0, // Not available in list view
    max_skips_effective: 8,
    skip_remaining: 8,
    at_risk_decadence: false,

    // Migration & debt fields with safe defaults
    debts_total: 0,
    debts_migrated: 0,
    migrated_debt_numbers: [],
    remaining_debt_numbers: [],
    rq_target_ids: [],
    rq_migration_status: "none",
    excluded_from_stats: false,
  } as RateationRow;
}