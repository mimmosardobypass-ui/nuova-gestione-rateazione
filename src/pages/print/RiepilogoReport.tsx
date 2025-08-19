import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PrintLayout from "@/components/print/PrintLayout";
import { PrintKpi } from "@/components/print/PrintKpi";
import { formatEuro } from "@/lib/formatters";

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
}

export default function RiepilogoReport() {
  const [searchParams] = useSearchParams();
  const [rows, setRows] = useState<RiepilogoRow[]>([]);
  const [loading, setLoading] = useState(true);

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
        // piccolo buffer per QR/logo/font
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
      const { data } = await supabase
        .from("v_rateation_summary")
        .select("*")
        .order("last_activity", { ascending: false });

      let filteredRows = data || [];

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

      setRows(filteredRows);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const sum = (field: keyof RiepilogoRow) => 
    rows.reduce((s, r) => s + Number(r[field] || 0), 0);

  const subtitle = [
    `Filtri: periodo ${searchParams.get("from") || "—"} → ${searchParams.get("to") || "—"}`,
    searchParams.get("type") ? `tipo ${searchParams.get("type")}` : null,
    searchParams.get("state") ? `stato ${searchParams.get("state")}` : null
  ].filter(Boolean).join(" • ");

  if (loading) {
    return <div>Caricamento...</div>;
  }

  return (
    <PrintLayout 
      title="Riepilogo Rateazioni" 
      subtitle={subtitle}
      logoUrl={logoUrl}
      bodyClass={bodyClass}
    >
      {/* KPI Section */}
      <section className="grid grid-cols-4 gap-3 mb-6">
        <PrintKpi label="Importo totale" value={formatEuro(sum("importo_totale"))} />
        <PrintKpi label="Pagato (quota)" value={formatEuro(sum("importo_pagato_quota"))} />
        <PrintKpi label="Extra ravvedimento" value={formatEuro(sum("extra_ravv_pagati"))} />
        <PrintKpi label="Residuo" value={formatEuro(sum("totale_residuo"))} />
      </section>

      {/* Data Table */}
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
              <td className="text-right">{formatEuro(r.totale_residuo)}</td>
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
            <td className="text-right">{formatEuro(sum("totale_residuo"))}</td>
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