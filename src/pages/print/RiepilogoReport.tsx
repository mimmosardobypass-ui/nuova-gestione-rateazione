import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PrintLayout from "@/components/print/PrintLayout";
import { PrintBreakdownSection } from "@/components/print/PrintBreakdownSection";
import {
  PrintKpiCard,
  PrintKpiResidual,
  PrintF24Card,
  PrintPagopaCard,
  PrintRottamazioniCard,
  PrintFinancialBalanceCard,
  PrintSaldoDecadutoCard,
} from "@/components/print/PrintDashboardCards";
import { formatEuro } from "@/lib/formatters";
import { ensureStringId } from "@/lib/utils/ids";
import { totalsForExport } from "@/utils/rateation-export";
import { 
  fetchDueByType, 
  fetchPaidByType, 
  fetchResidualByType,
  type KpiBreakdown
} from "@/features/rateations/api/kpi";

interface RiepilogoRow {
  id: string;
  numero: string;
  type_name: string | null;
  taxpayer_name: string | null;
  importo_totale: number;
  importo_pagato_quota: number;
  extra_ravv_pagati: number;
  totale_residuo: number;
  rate_totali: number;
  rate_pagate: number;
  rate_in_ritardo: number;
  rate_pagate_ravv: number;
  first_due_date: string | null;
  last_due_date: string | null;
  last_activity: string | null;
  status?: string;
  interrupted_by_rateation_id?: number | null;
  calculated_residual?: number;
}

// Costanti per categorizzazione (stessa logica di useRateationStats)
const F24_ACTIVE = ['F24'];
const F24_PAID = ['F24', 'F24 Completate'];
const F24_DECADUTE = ['F24 Decadute'];
const PAGOPA_ACTIVE = ['PagoPa'];
const PAGOPA_PAID = ['PagoPa', 'PagoPA Completate'];
const ROTTAMAZIONI_TYPES = ['Rottamazione Quater', 'Riam. Quater', 'Rottamazione Quinquies'];

const sumByTypes = (breakdown: KpiBreakdown, types: string[]) => 
  types.reduce((sum, type) => {
    const found = breakdown.find(b => b.type_label === type);
    return sum + (found?.amount_cents ?? 0);
  }, 0);

export default function RiepilogoReport() {
  const [searchParams] = useSearchParams();
  const [rows, setRows] = useState<RiepilogoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [kpiTotals, setKpiTotals] = useState({
    totalDue: 0,
    totalPaid: 0,
    totalResidual: 0,
    totalResidualPending: 0,
    totalResidualCombined: 0,
    totalLate: 0,
  });
  const [breakdown, setBreakdown] = useState<{
    due: KpiBreakdown;
    paid: KpiBreakdown;
    residual: KpiBreakdown;
  }>({ due: [], paid: [], residual: [] });
  const [savings, setSavings] = useState({ rq: 0, r5: 0 });
  const [costF24PagoPA, setCostF24PagoPA] = useState(0);
  const [decadenceData, setDecadenceData] = useState({
    grossDecayed: 0,
    transferred: 0,
    netToTransfer: 0,
  });

  const theme = searchParams.get("theme") === "bn" ? "theme-bn" : "";
  const density = searchParams.get("density") === "compact" ? "density-compact" : "";
  const bodyClass = `${theme} ${density}`.trim();
  const logoUrl = searchParams.get("logo") || undefined;

  useEffect(() => {
    loadData();
  }, []);

  // Auto-print robusto
  useEffect(() => {
    if (!loading) {
      const go = async () => {
        try { await (document as any).fonts?.ready; } catch {}
        setTimeout(() => {
          window.focus();
          window.print();
        }, 250);
      };
      go();
    }
  }, [loading]);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Carica tutti i dati necessari in parallelo
      const [
        dueByType, 
        paidByType, 
        residualByType, 
        savingRQData, 
        savingR5Data,
        costData,
        decadutoData,
      ] = await Promise.all([
        fetchDueByType(),
        fetchPaidByType(),
        fetchResidualByType(),
        user ? supabase
          .from("v_quater_saving_per_user")
          .select("saving_eur")
          .eq("owner_uid", user.id)
          .maybeSingle() : Promise.resolve({ data: null }),
        user ? supabase
          .from("v_quinquies_saving_per_user")
          .select("saving_eur")
          .eq("owner_uid", user.id)
          .maybeSingle() : Promise.resolve({ data: null }),
        user ? supabase
          .from("v_f24_pagopa_cost_per_user")
          .select("cost_eur")
          .eq("owner_uid", user.id)
          .maybeSingle() : Promise.resolve({ data: null }),
        supabase
          .from("v_dashboard_decaduto")
          .select("*")
          .maybeSingle(),
      ]);
      
      // Store breakdown for cards
      setBreakdown({ due: dueByType, paid: paidByType, residual: residualByType });
      setSavings({ 
        rq: savingRQData?.data?.saving_eur ?? 0, 
        r5: savingR5Data?.data?.saving_eur ?? 0 
      });
      setCostF24PagoPA(costData?.data?.cost_eur ?? 0);
      setDecadenceData({
        grossDecayed: Number(decadutoData?.data?.gross_decayed_cents ?? 0) / 100,
        transferred: Number(decadutoData?.data?.transferred_cents ?? 0) / 100,
        netToTransfer: Number(decadutoData?.data?.net_to_transfer_cents ?? 0) / 100,
      });

      // Applica stessa logica di computeHeaderFromCards
      const f24DueCents = sumByTypes(dueByType, F24_ACTIVE);
      const f24PaidCents = sumByTypes(paidByType, F24_PAID);
      const f24ResidualCents = f24DueCents - f24PaidCents;

      const pagopaDueCents = sumByTypes(dueByType, PAGOPA_ACTIVE);
      const pagopaPaidCents = sumByTypes(paidByType, PAGOPA_PAID);
      const pagopaResidualCents = pagopaDueCents - pagopaPaidCents;

      const rottDueCents = sumByTypes(dueByType, ROTTAMAZIONI_TYPES);
      const rottPaidCents = sumByTypes(paidByType, ROTTAMAZIONI_TYPES);
      const rottResidualCents = sumByTypes(residualByType, ROTTAMAZIONI_TYPES);

      const f24DecaduteCents = sumByTypes(residualByType, F24_DECADUTE);

      // Calculate "In ritardo" from overdue items
      const overdueF24 = residualByType.find(b => b.type_label === 'F24')?.amount_cents ?? 0;
      const overduePagopa = residualByType.find(b => b.type_label === 'PagoPa')?.amount_cents ?? 0;
      
      setKpiTotals({
        totalDue: (f24DueCents + pagopaDueCents + rottDueCents) / 100,
        totalPaid: (f24PaidCents + pagopaPaidCents + rottPaidCents) / 100,
        totalResidual: (f24ResidualCents + pagopaResidualCents + rottResidualCents) / 100,
        totalResidualPending: f24DecaduteCents / 100,
        totalResidualCombined: (f24ResidualCents + pagopaResidualCents + rottResidualCents + f24DecaduteCents) / 100,
        totalLate: (overdueF24 + overduePagopa) / 100, // Placeholder - would need proper overdue calculation
      });

      // Carica dati dalla vista per la tabella
      const { data } = await supabase
        .from("v_rateation_summary")
        .select("*")
        .order("last_activity", { ascending: false });

      let filteredRows = data || [];

      // Carica dati aggiuntivi per le rateazioni (status, interrupted_by_rateation_id)
      const rateationIds = filteredRows.map(r => Number(r.id));
      const { data: additionalData } = await supabase
        .from("rateations")
        .select("id, status, interrupted_by_rateation_id")
        .in("id", rateationIds);

      // Carica installments per calcolo corretto del residuo
      const { data: installmentsData } = await supabase
        .from("installments")
        .select("rateation_id, amount, is_paid")
        .in("rateation_id", rateationIds);

      // Mappa dati aggiuntivi per ID
      const additionalMap = new Map(
        (additionalData || []).map(item => [String(item.id), item])
      );
      
      // Mappa installments per rateation_id
      const installmentsMap = new Map<string, { amount: number; is_paid: boolean }[]>();
      (installmentsData || []).forEach(inst => {
        const key = String(inst.rateation_id);
        if (!installmentsMap.has(key)) {
          installmentsMap.set(key, []);
        }
        installmentsMap.get(key)!.push({
          amount: inst.amount || 0,
          is_paid: !!inst.is_paid
        });
      });

      // Apply filters
      const type = searchParams.get("type");
      const state = searchParams.get("state");
      const from = searchParams.get("from");
      const to = searchParams.get("to");

      if (type) {
        filteredRows = filteredRows.filter(r => 
          (r.type_name || "").toLowerCase() === type.toLowerCase()
        );
      }

      if (state) {
        filteredRows = filteredRows.filter(r => {
          const paid = Number(r.rate_pagate) >= Number(r.rate_totali);
          const late = Number(r.rate_in_ritardo) > 0;
          const open = !paid && !late;
          
          return (state === "paid" && paid) ||
                 (state === "late" && late) ||
                 (state === "open" && open);
        });
      }

      if (from || to) {
        const fromDate = from ? new Date(from) : null;
        const toDate = to ? new Date(to) : null;
        
        filteredRows = filteredRows.filter(r => {
          const minDate = r.first_due_date ? new Date(r.first_due_date) : null;
          const maxDate = r.last_due_date ? new Date(r.last_due_date) : null;
          
          if (!minDate || !maxDate) return true;
          if (fromDate && maxDate < fromDate) return false;
          if (toDate && minDate > toDate) return false;
          return true;
        });
      }

      const convertedRows = filteredRows.map(row => {
        const id = ensureStringId(row.id);
        const additional = additionalMap.get(id);
        const installments = installmentsMap.get(id) || [];
        
        // Calcola residuo corretto usando la stessa logica dell'UI
        let calculated_residual = row.totale_residuo;
        if (additional) {
          const totals = totalsForExport(row, installments, {
            status: additional.status,
            interrupted_by_rateation_id: additional.interrupted_by_rateation_id ? String(additional.interrupted_by_rateation_id) : null
          });
          calculated_residual = totals.residual;
        }

        return {
          ...row,
          id,
          status: additional?.status,
          interrupted_by_rateation_id: additional?.interrupted_by_rateation_id,
          calculated_residual
        };
      });
      setRows(convertedRows);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const sum = (field: keyof RiepilogoRow) => 
    rows.reduce((s, r) => s + Number(r[field] || 0), 0);

  const sumResidual = () => 
    rows.reduce((s, r) => s + (r.calculated_residual ?? 0), 0);

  const subtitle = [
    `Filtri: periodo ${searchParams.get("from") || "—"} → ${searchParams.get("to") || "—"}`,
    searchParams.get("type") ? `tipo ${searchParams.get("type")}` : null,
    searchParams.get("state") ? `stato ${searchParams.get("state")}` : null
  ].filter(Boolean).join(" • ");

  if (loading) {
    return <div className="p-8 text-center">Caricamento...</div>;
  }

  return (
    <PrintLayout 
      title="Riepilogo Rateazioni" 
      subtitle={subtitle}
      logoUrl={logoUrl}
      bodyClass={bodyClass}
    >
      {/* ===== DASHBOARD SECTION ===== */}
      
      {/* Row 1: KPI Header (4 cards) - exactly like dashboard */}
      <section className="grid grid-cols-4 gap-3 mb-4">
        <PrintKpiCard 
          label="Totale dovuto" 
          value={formatEuro(kpiTotals.totalDue)} 
        />
        <PrintKpiCard 
          label="Totale pagato" 
          value={formatEuro(kpiTotals.totalPaid)} 
        />
        <PrintKpiResidual 
          residualActive={kpiTotals.totalResidual}
          residualPending={kpiTotals.totalResidualPending}
          residualTotal={kpiTotals.totalResidualCombined}
        />
        <PrintKpiCard 
          label="In ritardo" 
          value={formatEuro(sum("rate_in_ritardo") * 100)} // Convert to cents then format
          variant="danger"
        />
      </section>

      {/* Row 2: Type Cards (F24, PagoPA, Rottamazioni) */}
      <section className="grid grid-cols-3 gap-3 mb-4">
        <PrintF24Card breakdown={breakdown} />
        <PrintPagopaCard breakdown={breakdown} />
        <PrintRottamazioniCard 
          breakdown={breakdown} 
          savingRQ={savings.rq} 
          savingR5={savings.r5} 
        />
      </section>

      {/* Row 3: Financial Balance + Saldo Decaduto */}
      <section className="grid grid-cols-2 gap-3 mb-6">
        <PrintFinancialBalanceCard 
          savingRQ={savings.rq}
          savingR5={savings.r5}
          costF24PagoPA={costF24PagoPA}
        />
        <PrintSaldoDecadutoCard 
          grossDecayed={decadenceData.grossDecayed}
          transferred={decadenceData.transferred}
          netToTransfer={decadenceData.netToTransfer}
        />
      </section>

      {/* ===== DETAIL BREAKDOWN SECTION ===== */}
      <section className="mb-6 avoid-break">
        <h2 className="text-sm font-semibold mb-3 border-b pb-1">Dettaglio per Tipologia (tabella)</h2>
        <PrintBreakdownSection 
          breakdown={breakdown}
          savingRQ={savings.rq}
          savingR5={savings.r5}
        />
      </section>

      {/* General Total Summary */}
      <section className="mb-6 p-4 border-2 border-foreground rounded bg-muted/50 avoid-break">
        <div className="text-center font-bold text-sm mb-2">TOTALE GENERALE</div>
        <div className="grid grid-cols-3 gap-4 text-center text-xs">
          <div>
            <span className="text-muted-foreground">Dovuto:</span>{" "}
            <span className="font-semibold tabular-nums">{formatEuro(kpiTotals.totalDue)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Pagato:</span>{" "}
            <span className="font-semibold tabular-nums">{formatEuro(kpiTotals.totalPaid)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Residuo:</span>{" "}
            <span className="font-semibold tabular-nums">{formatEuro(kpiTotals.totalResidual)}</span>
          </div>
        </div>
        {kpiTotals.totalResidualPending > 0 && (
          <div className="text-center mt-2 pt-2 border-t text-xs">
            <span className="text-amber-600">+ In Attesa Cartelle: {formatEuro(kpiTotals.totalResidualPending)}</span>
            <span className="font-bold ml-2">= DEBITO TOTALE: {formatEuro(kpiTotals.totalResidualCombined)}</span>
          </div>
        )}
        {(savings.rq > 0 || savings.r5 > 0) && (
          <div className="text-center mt-2 pt-2 border-t text-xs text-emerald-600">
            Risparmio Totale: {formatEuro(savings.rq + savings.r5)} 
            {savings.rq > 0 && savings.r5 > 0 && (
              <span className="text-muted-foreground ml-1">
                (RQ: {formatEuro(savings.rq)} + R5: {formatEuro(savings.r5)})
              </span>
            )}
          </div>
        )}
      </section>

      {/* Page break before table */}
      <div className="page-break" />

      {/* Data Table */}
      <h2 className="text-sm font-semibold mb-3 border-b pb-1">Elenco Rateazioni</h2>
      <table className="print-table">
        <thead>
          <tr>
            <th>Numero</th>
            <th>Tipo</th>
            <th>Contribuente</th>
            <th className="text-right">Totale</th>
            <th className="text-right">Pagato (quota)</th>
            <th className="text-right">Extra ravv.</th>
            <th className="text-right">Residuo</th>
            <th className="text-center">Rate</th>
            <th className="text-center">Pagate</th>
            <th className="text-center">Pagate (Rav.)</th>
            <th className="text-center">In ritardo</th>
            <th>Ultima attività</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} className="avoid-break">
              <td>{r.numero}</td>
              <td>{r.type_name || "-"}</td>
              <td>{r.taxpayer_name || "-"}</td>
              <td className="text-right">{formatEuro(r.importo_totale)}</td>
              <td className="text-right">{formatEuro(r.importo_pagato_quota)}</td>
              <td className="text-right">{formatEuro(r.extra_ravv_pagati)}</td>
              <td className="text-right">{formatEuro(r.calculated_residual ?? r.totale_residuo)}</td>
              <td className="text-center">{r.rate_totali}</td>
              <td className="text-center">{r.rate_pagate}</td>
              <td className="text-center">{r.rate_pagate_ravv}</td>
              <td className="text-center">{r.rate_in_ritardo}</td>
              <td>
                {r.last_activity ? 
                  new Date(r.last_activity).toLocaleDateString("it-IT") : 
                  "-"
                }
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-semibold">
            <td colSpan={3}>Totali</td>
            <td className="text-right">{formatEuro(sum("importo_totale"))}</td>
            <td className="text-right">{formatEuro(sum("importo_pagato_quota"))}</td>
            <td className="text-right">{formatEuro(sum("extra_ravv_pagati"))}</td>
            <td className="text-right">{formatEuro(sumResidual())}</td>
            <td className="text-center">{sum("rate_totali")}</td>
            <td className="text-center">{sum("rate_pagate")}</td>
            <td className="text-center">{sum("rate_pagate_ravv")}</td>
            <td className="text-center">{sum("rate_in_ritardo")}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </PrintLayout>
  );
}
