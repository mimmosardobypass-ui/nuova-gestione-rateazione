import React from "react";
import { FileText, CreditCard, Sprout, Wallet, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";
import { formatEuro, formatEuroFromCents } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { KpiBreakdown } from "@/features/rateations/api/kpi";

// ============================================================================
// Print KPI Header Cards
// ============================================================================

interface PrintKpiCardProps {
  label: string;
  value: string;
  variant?: "default" | "danger";
}

export function PrintKpiCard({ label, value, variant = "default" }: PrintKpiCardProps) {
  return (
    <div className={cn(
      "print-card",
      variant === "danger" && "border-red-500"
    )}>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{label}</div>
      <div className={cn(
        "text-lg font-bold tabular-nums",
        variant === "danger" && "text-red-600"
      )}>
        {value}
      </div>
    </div>
  );
}

interface PrintKpiResidualProps {
  residualActive: number;
  residualPending: number;
  residualTotal: number;
}

export function PrintKpiResidual({ residualActive, residualPending, residualTotal }: PrintKpiResidualProps) {
  const hasPending = residualPending > 0;

  return (
    <div className="print-card">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Totale residuo</div>
      {hasPending ? (
        <div className="space-y-0.5">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Residuo Attivo</span>
            <span className="tabular-nums">{formatEuro(residualActive)}</span>
          </div>
          <div className="flex justify-between text-xs text-amber-600">
            <span>In Attesa Cartelle</span>
            <span className="tabular-nums">{formatEuro(residualPending)}</span>
          </div>
          <div className="border-t pt-1 mt-1 flex justify-between font-bold text-sm">
            <span>Totale</span>
            <span className="tabular-nums">{formatEuro(residualTotal)}</span>
          </div>
        </div>
      ) : (
        <div className="text-lg font-bold tabular-nums">{formatEuro(residualTotal)}</div>
      )}
    </div>
  );
}

// ============================================================================
// Print F24 Card
// ============================================================================

type F24Categories = 'F24' | 'F24 Completate' | 'F24 Migrate' | 'F24 Decadute';

const F24_CONFIG: Record<F24Categories, { label: string; dotClass: string }> = {
  'F24': { label: 'Attive', dotClass: 'print-dot-blue' },
  'F24 Completate': { label: 'Completate', dotClass: 'print-dot-green' },
  'F24 Migrate': { label: 'Migrate', dotClass: 'print-dot-orange' },
  'F24 Decadute': { label: 'Decadute', dotClass: 'print-dot-red' },
};

interface PrintF24CardProps {
  breakdown: {
    due: KpiBreakdown;
    paid: KpiBreakdown;
    residual: KpiBreakdown;
  };
}

export function PrintF24Card({ breakdown }: PrintF24CardProps) {
  const categories: F24Categories[] = ['F24', 'F24 Completate', 'F24 Migrate', 'F24 Decadute'];
  
  const getData = (cat: F24Categories) => ({
    due: breakdown.due.find(b => b.type_label === cat)?.amount_cents ?? 0,
    paid: breakdown.paid.find(b => b.type_label === cat)?.amount_cents ?? 0,
    residual: breakdown.residual.find(b => b.type_label === cat)?.amount_cents ?? 0,
  });

  const hasData = (cat: F24Categories) => {
    const d = getData(cat);
    return d.due > 0 || d.paid > 0 || d.residual > 0;
  };

  // Totals: Due = Active only, Paid = Active + Completate
  const activeData = getData('F24');
  const completateData = getData('F24 Completate');
  const totalPaid = activeData.paid + completateData.paid;
  const totals = {
    due: activeData.due,
    paid: totalPaid,
    residual: activeData.due - totalPaid,
  };

  return (
    <div className="print-card">
      <div className="print-card-header">
        <div className="icon bg-blue-100">
          <FileText className="h-3.5 w-3.5 text-blue-600" />
        </div>
        <span>F24</span>
      </div>

      {/* Header row */}
      <div className="print-breakdown-grid print-breakdown-header">
        <div></div>
        <div className="text-right">Dovuto</div>
        <div className="text-right">Pagato</div>
        <div className="text-right">Residuo</div>
      </div>

      {/* Category rows */}
      {categories.map(cat => {
        if (!hasData(cat)) return null;
        const data = getData(cat);
        const config = F24_CONFIG[cat];
        return (
          <div key={cat} className="print-breakdown-grid py-1 border-b border-gray-100 last:border-0">
            <div className="flex items-center gap-1">
              <span className={cn("print-category-dot", config.dotClass)} />
              <span className="font-medium">{config.label}</span>
            </div>
            <div className="text-right tabular-nums">{formatEuroFromCents(data.due)}</div>
            <div className="text-right tabular-nums">{formatEuroFromCents(data.paid)}</div>
            <div className="text-right tabular-nums">{formatEuroFromCents(data.residual)}</div>
          </div>
        );
      })}

      {/* Footer */}
      <div className="print-card-footer">
        <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
          Riepilogo Debito Attivo
        </div>
        <div className="space-y-0.5 text-[10px]">
          <div className="flex justify-between">
            <span className="font-medium">Totale Dovuto</span>
            <span className="font-bold tabular-nums">{formatEuroFromCents(totals.due)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Totale Pagato</span>
            <span className="tabular-nums">{formatEuroFromCents(totals.paid)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Totale Residuo</span>
            <span className="tabular-nums font-medium">{formatEuroFromCents(totals.residual)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Print PagoPA Card
// ============================================================================

type PagopaCategories = 'PagoPa' | 'PagoPA Completate' | 'PagoPA Interrotte' | 'PagoPA Migrate RQ' | 'PagoPA Migrate R5';

const PAGOPA_CONFIG: Record<PagopaCategories, { label: string; dotClass: string }> = {
  'PagoPa': { label: 'Attive', dotClass: 'print-dot-blue' },
  'PagoPA Completate': { label: 'Completate', dotClass: 'print-dot-green' },
  'PagoPA Interrotte': { label: 'Interrotte', dotClass: 'print-dot-red' },
  'PagoPA Migrate RQ': { label: 'Migrate RQ', dotClass: 'print-dot-emerald' },
  'PagoPA Migrate R5': { label: 'Migrate R5', dotClass: 'print-dot-violet' },
};

interface PrintPagopaCardProps {
  breakdown: {
    due: KpiBreakdown;
    paid: KpiBreakdown;
    residual: KpiBreakdown;
  };
}

export function PrintPagopaCard({ breakdown }: PrintPagopaCardProps) {
  const categories: PagopaCategories[] = ['PagoPa', 'PagoPA Completate', 'PagoPA Interrotte', 'PagoPA Migrate RQ', 'PagoPA Migrate R5'];
  
  const getData = (cat: PagopaCategories) => ({
    due: breakdown.due.find(b => b.type_label === cat)?.amount_cents ?? 0,
    paid: breakdown.paid.find(b => b.type_label === cat)?.amount_cents ?? 0,
    residual: breakdown.residual.find(b => b.type_label === cat)?.amount_cents ?? 0,
  });

  const hasData = (cat: PagopaCategories) => {
    const d = getData(cat);
    return d.due > 0 || d.paid > 0 || d.residual > 0;
  };

  // Totals: Due = Active only, Paid = Active + Completate
  const activeData = getData('PagoPa');
  const completateData = getData('PagoPA Completate');
  const totalPaid = activeData.paid + completateData.paid;
  const totals = {
    due: activeData.due,
    paid: totalPaid,
    residual: activeData.due - totalPaid,
  };

  return (
    <div className="print-card">
      <div className="print-card-header">
        <div className="icon bg-purple-100">
          <CreditCard className="h-3.5 w-3.5 text-purple-600" />
        </div>
        <span>PagoPA</span>
      </div>

      {/* Header row */}
      <div className="print-breakdown-grid print-breakdown-header">
        <div></div>
        <div className="text-right">Dovuto</div>
        <div className="text-right">Pagato</div>
        <div className="text-right">Residuo</div>
      </div>

      {/* Category rows */}
      {categories.map(cat => {
        if (!hasData(cat)) return null;
        const data = getData(cat);
        const config = PAGOPA_CONFIG[cat];
        return (
          <div key={cat} className="print-breakdown-grid py-1 border-b border-gray-100 last:border-0">
            <div className="flex items-center gap-1">
              <span className={cn("print-category-dot", config.dotClass)} />
              <span className="font-medium">{config.label}</span>
            </div>
            <div className="text-right tabular-nums">{formatEuroFromCents(data.due)}</div>
            <div className="text-right tabular-nums">{formatEuroFromCents(data.paid)}</div>
            <div className="text-right tabular-nums">{formatEuroFromCents(data.residual)}</div>
          </div>
        );
      })}

      {/* Footer */}
      <div className="print-card-footer">
        <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
          Riepilogo Debito Attivo
        </div>
        <div className="space-y-0.5 text-[10px]">
          <div className="flex justify-between">
            <span className="font-medium">Totale Dovuto</span>
            <span className="font-bold tabular-nums">{formatEuroFromCents(totals.due)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Totale Pagato</span>
            <span className="tabular-nums">{formatEuroFromCents(totals.paid)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Totale Residuo</span>
            <span className="tabular-nums font-medium">{formatEuroFromCents(totals.residual)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Print Rottamazioni Card
// ============================================================================

type RottamazioniCategories = 'Rottamazione Quater' | 'Riam. Quater' | 'Rottamazione Quinquies';

const ROTT_CONFIG: Record<RottamazioniCategories, { label: string; dotClass: string }> = {
  'Rottamazione Quater': { label: 'Quater', dotClass: 'print-dot-amber' },
  'Riam. Quater': { label: 'Riam. Quater', dotClass: 'print-dot-emerald' },
  'Rottamazione Quinquies': { label: 'Quinquies', dotClass: 'print-dot-violet' },
};

interface PrintRottamazioniCardProps {
  breakdown: {
    due: KpiBreakdown;
    paid: KpiBreakdown;
    residual: KpiBreakdown;
  };
  savingRQ: number;
  savingR5: number;
}

export function PrintRottamazioniCard({ breakdown, savingRQ, savingR5 }: PrintRottamazioniCardProps) {
  const categories: RottamazioniCategories[] = ['Rottamazione Quater', 'Riam. Quater', 'Rottamazione Quinquies'];
  
  const getData = (cat: RottamazioniCategories) => ({
    due: breakdown.due.find(b => b.type_label === cat)?.amount_cents ?? 0,
    paid: breakdown.paid.find(b => b.type_label === cat)?.amount_cents ?? 0,
    residual: breakdown.residual.find(b => b.type_label === cat)?.amount_cents ?? 0,
  });

  // Calculate totals
  const totals = categories.reduce((acc, cat) => {
    const data = getData(cat);
    return {
      due: acc.due + data.due,
      paid: acc.paid + data.paid,
      residual: acc.residual + data.residual,
    };
  }, { due: 0, paid: 0, residual: 0 });

  return (
    <div className="print-card">
      <div className="print-card-header">
        <div className="icon bg-emerald-100">
          <Sprout className="h-3.5 w-3.5 text-emerald-600" />
        </div>
        <span>Rottamazioni</span>
      </div>

      {/* Header row */}
      <div className="print-breakdown-grid print-breakdown-header">
        <div></div>
        <div className="text-right">Dovuto</div>
        <div className="text-right">Pagato</div>
        <div className="text-right">Residuo</div>
      </div>

      {/* Category rows with savings */}
      {categories.map(cat => {
        const data = getData(cat);
        const config = ROTT_CONFIG[cat];
        const showSaving = (cat === 'Riam. Quater' && savingRQ > 0) || (cat === 'Rottamazione Quinquies' && savingR5 > 0);
        const saving = cat === 'Riam. Quater' ? savingRQ : savingR5;
        
        // Always show Quinquies even with 0 values
        const hasData = data.due > 0 || data.paid > 0 || data.residual > 0 || cat === 'Rottamazione Quinquies';
        if (!hasData) return null;

        return (
          <React.Fragment key={cat}>
            <div className="print-breakdown-grid py-1 border-b border-gray-100">
              <div className="flex items-center gap-1">
                <span className={cn("print-category-dot", config.dotClass)} />
                <span className="font-medium">{config.label}</span>
              </div>
              <div className="text-right tabular-nums">{formatEuroFromCents(data.due)}</div>
              <div className="text-right tabular-nums">{formatEuroFromCents(data.paid)}</div>
              <div className="text-right tabular-nums">{formatEuroFromCents(data.residual)}</div>
            </div>
            {showSaving && (
              <div className="print-breakdown-grid py-0.5 pl-4 text-[9px] text-emerald-600 border-b border-gray-100">
                <div className="col-span-3 text-right">└ Risparmio</div>
                <div className="text-right tabular-nums font-medium">{formatEuro(saving)}</div>
              </div>
            )}
          </React.Fragment>
        );
      })}

      {/* Footer */}
      <div className="print-card-footer">
        <div className="print-breakdown-grid font-semibold text-[10px]">
          <div>TOTALE</div>
          <div className="text-right tabular-nums">{formatEuroFromCents(totals.due)}</div>
          <div className="text-right tabular-nums">{formatEuroFromCents(totals.paid)}</div>
          <div className="text-right tabular-nums">{formatEuroFromCents(totals.residual)}</div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Print Financial Balance Card
// ============================================================================

interface PrintFinancialBalanceCardProps {
  savingRQ: number;
  savingR5: number;
  costF24PagoPA: number;
}

export function PrintFinancialBalanceCard({ savingRQ, savingR5, costF24PagoPA }: PrintFinancialBalanceCardProps) {
  const netBalance = savingRQ + savingR5 - costF24PagoPA;
  const isPositive = netBalance >= 0;

  return (
    <div className={cn(
      "print-card",
      isPositive ? "print-balance-positive" : "print-balance-negative"
    )}>
      <div className="print-card-header">
        <div className={cn("icon", isPositive ? "bg-emerald-100" : "bg-red-100")}>
          <Wallet className={cn("h-3.5 w-3.5", isPositive ? "text-emerald-600" : "text-red-600")} />
        </div>
        <span>Bilancio Finanziario</span>
      </div>

      <div className="text-center mb-3">
        <div className="text-[10px] text-muted-foreground mb-1">Saldo Netto</div>
        <div className="print-balance-value flex items-center justify-center gap-2">
          {formatEuro(netBalance)}
          {isPositive ? (
            <TrendingUp className="h-5 w-5 text-emerald-600" />
          ) : (
            <TrendingDown className="h-5 w-5 text-red-600" />
          )}
        </div>
      </div>

      <div className="space-y-1.5 text-[10px]">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-1.5">
            <Sprout className="h-3 w-3 text-emerald-600" />
            <span>Risparmio RQ</span>
          </div>
          <span className="print-badge print-badge-emerald tabular-nums">+{formatEuro(savingRQ)}</span>
        </div>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-1.5">
            <Sprout className="h-3 w-3 text-violet-600" />
            <span>Risparmio R5</span>
          </div>
          <span className="print-badge print-badge-violet tabular-nums">+{formatEuro(savingR5)}</span>
        </div>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-3 w-3 text-red-600" />
            <span>Costo F24→PagoPA</span>
          </div>
          <span className="print-badge print-badge-red tabular-nums">-{formatEuro(costF24PagoPA)}</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Print Saldo Decaduto Card
// ============================================================================

interface PrintSaldoDecadutoCardProps {
  grossDecayed: number;
  transferred: number;
  netToTransfer: number;
}

export function PrintSaldoDecadutoCard({ grossDecayed, transferred, netToTransfer }: PrintSaldoDecadutoCardProps) {
  const progressPercent = grossDecayed > 0 
    ? Math.min(100, Math.round((transferred / grossDecayed) * 100)) 
    : 0;

  return (
    <div className="print-card">
      <div className="print-card-header">
        <div className="icon bg-amber-100">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
        </div>
        <span>Saldo Decaduto</span>
      </div>

      <div className="text-center mb-3">
        <div className="text-2xl font-bold tabular-nums text-amber-600">
          {formatEuro(grossDecayed)}
        </div>
        <div className="text-[10px] text-muted-foreground">Netto da trasferire</div>
      </div>

      <div className="space-y-2 text-[10px]">
        <div className="p-2 bg-gray-50 rounded border">
          <div className="flex justify-between mb-1">
            <span className="text-muted-foreground">Decaduto lordo</span>
            <span className="tabular-nums font-medium">{formatEuro(grossDecayed)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Già trasferito</span>
            <span className="tabular-nums font-medium text-emerald-600">-{formatEuro(transferred)}</span>
          </div>
        </div>

        <div>
          <div className="flex justify-between text-[9px] text-muted-foreground mb-1">
            <span>Trasferimento</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="print-progress-bar">
            <div className="print-progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}
