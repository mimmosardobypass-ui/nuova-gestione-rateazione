import React from "react";
import type { KpiBreakdown } from "@/features/rateations/api/kpi";
import { formatEuro } from "@/lib/formatters";

interface PrintBreakdownSectionProps {
  breakdown: {
    due: KpiBreakdown;
    paid: KpiBreakdown;
    residual: KpiBreakdown;
  };
  savingRQ: number;
  savingR5: number;
}

// Helper to get value from breakdown
const getValue = (breakdown: KpiBreakdown, typeLabel: string): number => {
  const found = breakdown.find(b => b.type_label === typeLabel);
  return (found?.amount_cents ?? 0) / 100;
};

// Sum multiple types
const sumTypes = (breakdown: KpiBreakdown, types: string[]): number => {
  return types.reduce((sum, type) => sum + getValue(breakdown, type), 0);
};

// F24 Categories
const F24_CATEGORIES = [
  { label: "Attive", type: "F24" },
  { label: "Completate", type: "F24 Completate" },
  { label: "Migrate", type: "F24 Migrate" },
  { label: "Decadute", type: "F24 Decadute" },
];

// PagoPA Categories
const PAGOPA_CATEGORIES = [
  { label: "Attive", type: "PagoPa" },
  { label: "Completate", type: "PagoPA Completate" },
  { label: "Migrate RQ", type: "PagoPA Migrate RQ" },
  { label: "Migrate R5", type: "PagoPA Migrate R5" },
];

// Rottamazioni Categories
const ROTTAMAZIONI_CATEGORIES = [
  { label: "Quater", type: "Rottamazione Quater", hasSaving: false },
  { label: "Riam. Quater", type: "Riam. Quater", hasSaving: true, savingKey: "RQ" },
  { label: "Quinquies", type: "Rottamazione Quinquies", hasSaving: true, savingKey: "R5" },
];

interface BreakdownTableProps {
  title: string;
  categories: { label: string; type: string; hasSaving?: boolean; savingKey?: string }[];
  breakdown: PrintBreakdownSectionProps["breakdown"];
  savingRQ?: number;
  savingR5?: number;
  calculateResidual?: boolean;
}

function BreakdownTable({ 
  title, 
  categories, 
  breakdown, 
  savingRQ = 0, 
  savingR5 = 0,
  calculateResidual = false 
}: BreakdownTableProps) {
  // Calculate totals
  const types = categories.map(c => c.type);
  const totalDue = sumTypes(breakdown.due, types);
  const totalPaid = sumTypes(breakdown.paid, types);
  const totalResidual = calculateResidual 
    ? totalDue - totalPaid 
    : sumTypes(breakdown.residual, types);

  return (
    <div className="mb-4 avoid-break">
      <table className="print-table w-full text-xs">
        <thead>
          <tr className="bg-muted">
            <th className="text-left font-semibold" colSpan={4}>{title}</th>
          </tr>
          <tr>
            <th className="text-left w-28"></th>
            <th className="text-right w-28">Dovuto</th>
            <th className="text-right w-28">Pagato</th>
            <th className="text-right w-28">Residuo</th>
          </tr>
        </thead>
        <tbody>
          {categories.map(cat => {
            const due = getValue(breakdown.due, cat.type);
            const paid = getValue(breakdown.paid, cat.type);
            const residual = calculateResidual 
              ? due - paid 
              : getValue(breakdown.residual, cat.type);
            
            const saving = cat.savingKey === "RQ" ? savingRQ : cat.savingKey === "R5" ? savingR5 : 0;
            
            return (
              <React.Fragment key={cat.type}>
                <tr>
                  <td className="text-left">{cat.label}</td>
                  <td className="text-right tabular-nums">{formatEuro(due)}</td>
                  <td className="text-right tabular-nums">{formatEuro(paid)}</td>
                  <td className="text-right tabular-nums">{formatEuro(residual)}</td>
                </tr>
                {cat.hasSaving && saving > 0 && (
                  <tr className="print-saving-row">
                    <td className="text-left pl-4 text-[10px]">└ Risparmio</td>
                    <td></td>
                    <td></td>
                    <td className="text-right tabular-nums text-[10px]">{formatEuro(saving)} ✓</td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="font-semibold border-t-2 border-border">
            <td className="text-left">Totale {title}</td>
            <td className="text-right tabular-nums">{formatEuro(totalDue)}</td>
            <td className="text-right tabular-nums">{formatEuro(totalPaid)}</td>
            <td className="text-right tabular-nums">{formatEuro(totalResidual)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function PrintBreakdownSection({ breakdown, savingRQ, savingR5 }: PrintBreakdownSectionProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:grid-cols-3">
      <BreakdownTable 
        title="F24" 
        categories={F24_CATEGORIES} 
        breakdown={breakdown}
        calculateResidual={true}
      />
      <BreakdownTable 
        title="PagoPA" 
        categories={PAGOPA_CATEGORIES} 
        breakdown={breakdown}
        calculateResidual={true}
      />
      <BreakdownTable 
        title="Rottamazioni" 
        categories={ROTTAMAZIONI_CATEGORIES} 
        breakdown={breakdown}
        savingRQ={savingRQ}
        savingR5={savingR5}
      />
    </div>
  );
}
