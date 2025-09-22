import React, { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PrintLayout from "@/components/print/PrintLayout";
import { formatEuro } from "@/lib/formatters";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import QRCode from "qrcode";
import { getDaysLate, getPaymentDate } from "@/features/rateations/lib/installmentState";
import { toMidnightLocal as toMidnight } from "@/features/rateations/utils/pagopaSkips";
import type { InstallmentUI } from "@/features/rateations/types";
import { ensureStringId } from "@/lib/utils/ids";
import { totalsForExport } from "@/utils/rateation-export";

interface RateationHeader {
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
  rate_pagate_ravv: number;
  last_activity: string | null;
  is_pagopa?: boolean;
  // Campi aggiuntivi per logica corretta
  status?: string;
  interrupted_by_rateation_id?: number | null;
  calculated_residual?: number;
}

interface InstallmentDetail {
  id: string;
  seq: number;
  due_date: string;
  amount: number;
  status: string;
  payment_mode: string | null;
  paid_date: string | null;
  extra_interest: number;
  extra_penalty: number;
  days_overdue: number;
  // Compatibility with InstallmentUI
  is_paid?: boolean;
  paid_at?: string | null;
  postponed?: boolean;
}

interface MonthlyForecast {
  month: string;
  amount: number;
  cnt: number;
}

export default function SchedaRateazione() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const [header, setHeader] = useState<RateationHeader | null>(null);
  const [installments, setInstallments] = useState<InstallmentDetail[]>([]);
  const [forecast, setForecast] = useState<MonthlyForecast[]>([]);
  const [qrCode, setQrCode] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // calcolo locale per stampa (in cima al componente)
  const todayMid = React.useMemo(() => toMidnight(new Date()), []);
  const unpaidOverdueToday = React.useMemo(
    () => installments.filter(inst => inst.status !== "paid" && inst.due_date && toMidnight(inst.due_date) < todayMid).length,
    [installments, todayMid]
  );

  const theme = searchParams.get("theme") === "bn" ? "theme-bn" : "";
  const density = searchParams.get("density") === "compact" ? "density-compact" : "";
  const bodyClass = `${theme} ${density}`.trim();
  const logoUrl = searchParams.get("logo") || undefined;

  useEffect(() => {
    if (id) {
      loadData();
      generateQRCode();
    }
  }, [id]);

  // Auto-print robusto
  useEffect(() => {
    if (!loading && header) {
      const go = async () => {
        try { await (document as any).fonts?.ready; } catch {}
        // piccolo buffer per QR/logo/font
        setTimeout(() => {
          window.focus();
          window.print();
        }, 250);
      };
      go();
    }
  }, [loading, header]);

  const loadData = async () => {
    try {
      // Load header data
      const { data: headerData } = await supabase
        .from("v_rateation_summary")
        .select("*")
        .eq("id", Number(id!))
        .single();

      // Load additional rateation data for correct calculations
      const { data: rateationData } = await supabase
        .from("rateations")
        .select("status, interrupted_by_rateation_id")
        .eq("id", Number(id!))
        .single();

      // Load installments
      const { data: installmentsData } = await supabase
        .from("v_rateation_installments")
        .select("*")
        .eq("rateation_id", Number(id!))
        .order("seq");

      // Load forecast (next 12 months)
      const { data: forecastData } = await supabase
        .from("v_deadlines_monthly")
        .select("*")
        .gte("month", new Date().toISOString().split("T")[0])
        .order("month")
        .limit(12);

      if (headerData) {
        // Calcola residuo corretto se abbiamo i dati aggiuntivi
        let calculated_residual = headerData.totale_residuo;
        if (rateationData && installmentsData) {
          const installments = installmentsData.map(inst => ({
            amount: inst.amount || 0,
            is_paid: inst.status === 'paid'
          }));
          const totals = totalsForExport(headerData, installments, {
            status: rateationData.status,
            interrupted_by_rateation_id: rateationData.interrupted_by_rateation_id ? String(rateationData.interrupted_by_rateation_id) : null
          });
          calculated_residual = totals.residual;
        }

        setHeader({
          ...headerData,
          id: ensureStringId(headerData.id),
          status: rateationData?.status,
          interrupted_by_rateation_id: rateationData?.interrupted_by_rateation_id,
          calculated_residual
        });
      }
      
      const convertedInstallments = (installmentsData || []).map(inst => ({
        ...inst,
        id: ensureStringId(inst.id),
      }));
      setInstallments(convertedInstallments);
      setForecast(forecastData || []);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const generateQRCode = async () => {
    try {
      const url = `${window.location.origin}/rateazioni/${id}`;
      const qr = await QRCode.toDataURL(url, { 
        margin: 0, 
        width: 120,
        color: { dark: "#000000", light: "#FFFFFF" }
      });
      setQrCode(qr);
    } catch (error) {
      console.error("Error generating QR code:", error);
    }
  };

  if (loading || !header) {
    return <div>Caricamento...</div>;
  }

  return (
    <PrintLayout
      title={`Scheda Rateazione #${header.numero}`}
      subtitle={`Contribuente: ${header.taxpayer_name || "-"}`}
      logoUrl={logoUrl}
      bodyClass={bodyClass}
    >
      {/* Header Section */}
      <section className="grid grid-cols-3 gap-4 mb-6">
        <div className="col-span-2 border rounded p-3">
          <div className="grid grid-cols-2 gap-3">
            <InfoField label="Importo totale" value={formatEuro(header.importo_totale)} />
            <InfoField label="Pagato (quota)" value={formatEuro(header.importo_pagato_quota)} />
            <InfoField label="Extra ravv." value={formatEuro(header.extra_ravv_pagati)} />
            <InfoField label="Residuo" value={formatEuro(header.calculated_residual ?? header.totale_residuo)} />
            <InfoField label="Rate totali" value={String(header.rate_totali)} />
            <InfoField label="Pagate (Rav.)" value={`${header.rate_pagate} (${header.rate_pagate_ravv})`} />
            <InfoField label="Ultima attività" value={
              header.last_activity ? 
                new Date(header.last_activity).toLocaleDateString("it-IT") : 
                "-"
            } />
            <InfoField label="Tipo" value={header.type_name || "-"} />
          </div>
          {header.is_pagopa && (
            <div className="mt-2 text-sm">
              <strong>In ritardo:</strong> {unpaidOverdueToday}
            </div>
          )}
        </div>
        <div className="qr-container">
          {qrCode && <img src={qrCode} alt="QR Code" />}
        </div>
      </section>

      {/* Installments Section */}
      <h2 className="mt-4 mb-3 font-semibold text-base">Rate</h2>
      <table className="print-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Scadenza</th>
            <th className="text-right">Importo</th>
            <th>Stato</th>
            <th>Pagata il</th>
            <th className="text-right">Extra ravv.</th>
            <th className="text-right">Totale versato</th>
            <th className="text-right" title="Pagate: differenza tra data pagamento e scadenza. Non pagate: differenza tra oggi e scadenza.">Giorni ritardo</th>
          </tr>
        </thead>
        <tbody>
          {installments.map((inst) => {
            const extra = Number(inst.extra_interest) + Number(inst.extra_penalty);
            const totale = Number(inst.amount) + extra;
            const stato = getStatusLabel(inst);

            // Create minimal compatibility object for utility functions
            const installmentForCalc = {
              is_paid: inst.status === "paid",
              paid_date: inst.paid_date,
              paid_at: inst.paid_date,
              due_date: inst.due_date,
              amount: inst.amount,
              seq: inst.seq
            };

            return (
              <tr key={inst.id} className="avoid-break">
                <td>{inst.seq}</td>
                <td>{new Date(inst.due_date).toLocaleDateString("it-IT")}</td>
                <td className="text-right">{formatEuro(inst.amount)}</td>
                <td>{stato}</td>
                <td>
                  {getPaymentDate(installmentForCalc as any) ? 
                    format(new Date(getPaymentDate(installmentForCalc as any)!), "dd/MM/yyyy", { locale: it }) : 
                    "—"
                  }
                </td>
                <td className="text-right">{extra ? formatEuro(extra) : "-"}</td>
                <td className="text-right">
                  {inst.status === "paid" ? formatEuro(totale) : "-"}
                </td>
                <td className="text-right">{getDaysLate(installmentForCalc as any)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Forecast Section */}
      <div className="page-break"></div>
      <h2 className="mt-4 mb-3 font-semibold text-base">Scadenze (prossimi mesi)</h2>
      <table className="print-table">
        <thead>
          <tr>
            <th>Mese</th>
            <th className="text-right">Importo</th>
            <th className="text-center"># rate</th>
          </tr>
        </thead>
        <tbody>
          {forecast.map((month) => (
            <tr key={month.month}>
              <td>
                {new Date(month.month).toLocaleDateString("it-IT", {
                  month: "long",
                  year: "numeric"
                })}
              </td>
              <td className="text-right">{formatEuro(month.amount)}</td>
              <td className="text-center">{month.cnt}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </PrintLayout>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}

function getStatusLabel(inst: InstallmentDetail): string {
  if (inst.status === "paid" && inst.payment_mode === "ravvedimento") {
    return "Pagata (Rav.)";
  }
  if (inst.status === "paid") {
    return "Pagata";
  }
  if (inst.days_overdue > 0) {
    return "In ritardo";
  }
  return "Aperta";
}