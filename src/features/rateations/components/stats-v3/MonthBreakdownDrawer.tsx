import { useState } from "react";
import { useMonthBreakdown } from "../../hooks/useMonthBreakdown";
import { useRateationsDetailForMonth } from "../../hooks/useRateationsDetailForMonth";
import { formatCurrencyCompact, formatPercentage, getTypeColor } from "../../utils/statsV3Formatters";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, ExternalLink, ArrowUpDown, ArrowUp, ArrowDown, FileDown, FileSpreadsheet, Printer } from "lucide-react";
import { 
  exportMonthBreakdownToExcel, 
  exportMonthBreakdownToPDF, 
  printMonthBreakdown,
  type MonthBreakdownExportData 
} from "../../utils/monthBreakdownExport";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  year: number | null;
  month: number | null;
  groupBy: 'due' | 'paid';
};

const MONTHS = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

function ExpandableTypeRow({
  row,
  year,
  month,
  groupBy = 'due',
}: {
  row: { type: string; paid_cents: number; unpaid_cents: number; total_cents: number; paid_pct: number };
  year: number | null;
  month: number | null;
  groupBy?: 'due' | 'paid';
}) {
  const [isOpen, setIsOpen] = useState(false);

  // State per ordinamento (unpaid table)
  const [unpaidSortField, setUnpaidSortField] = useState<'number' | 'taxpayer' | 'amount'>('amount');
  const [unpaidSortDir, setUnpaidSortDir] = useState<'asc' | 'desc'>('desc');

  // State per ordinamento (paid table)
  const [paidSortField, setPaidSortField] = useState<'number' | 'taxpayer' | 'amount'>('amount');
  const [paidSortDir, setPaidSortDir] = useState<'asc' | 'desc'>('desc');

  const { loading, paid, unpaid } = useRateationsDetailForMonth(
    isOpen ? year : null,
    isOpen ? month : null,
    isOpen ? row.type : null,
    groupBy
  );

  // Funzione per gestire il click sul column header
  const handleSort = (
    table: 'paid' | 'unpaid',
    field: 'number' | 'taxpayer' | 'amount'
  ) => {
    if (table === 'unpaid') {
      if (unpaidSortField === field) {
        setUnpaidSortDir(unpaidSortDir === 'asc' ? 'desc' : 'asc');
      } else {
        setUnpaidSortField(field);
        setUnpaidSortDir('desc');
      }
    } else {
      if (paidSortField === field) {
        setPaidSortDir(paidSortDir === 'asc' ? 'desc' : 'asc');
      } else {
        setPaidSortField(field);
        setPaidSortDir('desc');
      }
    }
  };

  // Funzione per ordinare array
  const sortRateations = (
    list: typeof paid,
    field: 'number' | 'taxpayer' | 'amount',
    dir: 'asc' | 'desc',
    amountKey: 'residual_cents' | 'amount_cents'
  ) => {
    return [...list].sort((a, b) => {
      let comparison = 0;
      
      if (field === 'number') {
        comparison = (a.number || '').localeCompare(b.number || '');
      } else if (field === 'taxpayer') {
        comparison = (a.taxpayer_name || '').localeCompare(b.taxpayer_name || '');
      } else {
        // amount
        comparison = (a[amountKey] || 0) - (b[amountKey] || 0);
      }
      
      return dir === 'asc' ? comparison : -comparison;
    });
  };

  // Ordinare i dati
  const sortedUnpaid = sortRateations(unpaid, unpaidSortField, unpaidSortDir, 'residual_cents');
  const sortedPaid = sortRateations(paid, paidSortField, paidSortDir, 'amount_cents');

  // Calcolare i totali
  const unpaidTotal = unpaid.reduce((sum, r) => sum + (r.residual_cents || 0), 0);
  const paidTotal = paid.reduce((sum, r) => sum + (r.amount_cents || 0), 0);

  // Preparare dati per export
  const exportData: MonthBreakdownExportData = {
    year: year!,
    month: month!,
    monthName: MONTHS[month! - 1],
    type: row.type,
    typeLabel: labelForType(row.type),
    paid: sortedPaid,
    unpaid: sortedUnpaid,
    paidTotal,
    unpaidTotal,
  };

  // Handler export
  const handleExportExcel = () => {
    exportMonthBreakdownToExcel(exportData);
  };

  const handleExportPDF = () => {
    exportMonthBreakdownToPDF(exportData);
  };

  const handlePrint = () => {
    printMonthBreakdown(exportData);
  };

  return (
    <>
      <tr 
        className="border-t hover:bg-muted/50 cursor-pointer transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <td className="px-3 py-2 min-w-[140px]">
          <div className="flex items-center gap-2">
            {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            <span
              className="inline-block w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: getTypeColor(row.type) }}
            />
            <span className="whitespace-nowrap">{labelForType(row.type)}</span>
          </div>
        </td>
        <td className="px-3 py-2 text-right text-green-600 whitespace-nowrap">
          {formatCurrencyCompact(row.paid_cents)}
        </td>
        <td className="px-3 py-2 text-right text-red-500 whitespace-nowrap">
          {formatCurrencyCompact(row.unpaid_cents)}
        </td>
        <td className="px-3 py-2 text-right font-medium whitespace-nowrap">
          {formatCurrencyCompact(row.total_cents)}
        </td>
        <td className="px-3 py-2 text-right whitespace-nowrap">{formatPercentage(row.paid_pct * 100)}</td>
      </tr>
      {isOpen && (
        <tr className="border-t bg-muted/20">
          <td colSpan={5} className="p-4">
            {loading && <Skeleton className="h-32 w-full" />}
            {!loading && (
              <div className="space-y-4">
                {/* Bottoni Export */}
                <div className="flex flex-wrap gap-2 justify-end pb-2 border-b">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportExcel}
                    className="gap-1.5"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    Excel
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportPDF}
                    className="gap-1.5"
                  >
                    <FileDown className="h-3.5 w-3.5" />
                    PDF
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrint}
                    className="gap-1.5"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    Stampa
                  </Button>
                </div>

                {/* Non Pagate */}
                {unpaid.length > 0 && (
                  <div>
                    <div className="text-sm font-semibold text-red-600 mb-2">
                      🔴 Non Pagate ({unpaid.length})
                    </div>
                    <div className="bg-background rounded-lg border overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/30">
                          <tr>
                            <SortableHeader
                              label="N. Rateazione"
                              field="number"
                              currentField={unpaidSortField}
                              currentDir={unpaidSortDir}
                              onClick={() => handleSort('unpaid', 'number')}
                              className="min-w-[120px]"
                            />
                            <SortableHeader
                              label="Contribuente"
                              field="taxpayer"
                              currentField={unpaidSortField}
                              currentDir={unpaidSortDir}
                              onClick={() => handleSort('unpaid', 'taxpayer')}
                            />
                            <SortableHeader
                              label="Residuo"
                              field="amount"
                              currentField={unpaidSortField}
                              currentDir={unpaidSortDir}
                              onClick={() => handleSort('unpaid', 'amount')}
                              align="right"
                              className="min-w-[90px]"
                            />
                          </tr>
                        </thead>
                        <tbody>
                          {sortedUnpaid.map((r) => (
                            <tr key={r.id} className="border-t hover:bg-muted/30">
                              <td className="px-2 py-1.5">
                                <a
                                  href={`/rateazioni?search=${r.number}`}
                                  className="text-primary hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {r.number}
                                </a>
                              </td>
                              <td className="px-2 py-1.5 truncate">{r.taxpayer_name || "—"}</td>
                              <td className="px-2 py-1.5 text-right font-medium text-red-600 whitespace-nowrap">
                                {formatCurrencyCompact(r.residual_cents)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="border-t-2 bg-muted/50 font-semibold">
                          <tr>
                            <td className="px-2 py-1.5" colSpan={2}>
                              Totale ({unpaid.length} rate)
                            </td>
                            <td className="px-2 py-1.5 text-right text-red-600 whitespace-nowrap">
                              {formatCurrencyCompact(unpaidTotal)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}

                {/* Pagate */}
                {paid.length > 0 && (
                  <div>
                    <div className="text-sm font-semibold text-green-600 mb-2">
                      🟢 Pagate ({paid.length})
                    </div>
                    <div className="bg-background rounded-lg border overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/30">
                          <tr>
                            <SortableHeader
                              label="N. Rateazione"
                              field="number"
                              currentField={paidSortField}
                              currentDir={paidSortDir}
                              onClick={() => handleSort('paid', 'number')}
                              className="min-w-[120px]"
                            />
                            <SortableHeader
                              label="Contribuente"
                              field="taxpayer"
                              currentField={paidSortField}
                              currentDir={paidSortDir}
                              onClick={() => handleSort('paid', 'taxpayer')}
                            />
                            <SortableHeader
                              label="Importo"
                              field="amount"
                              currentField={paidSortField}
                              currentDir={paidSortDir}
                              onClick={() => handleSort('paid', 'amount')}
                              align="right"
                              className="min-w-[90px]"
                            />
                          </tr>
                        </thead>
                        <tbody>
                          {sortedPaid.map((r) => (
                            <tr key={r.id} className="border-t hover:bg-muted/30">
                              <td className="px-2 py-1.5">
                                <a
                                  href={`/rateazioni?search=${r.number}`}
                                  className="text-primary hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {r.number}
                                </a>
                              </td>
                              <td className="px-2 py-1.5 truncate">{r.taxpayer_name || "—"}</td>
                              <td className="px-2 py-1.5 text-right font-medium text-green-600 whitespace-nowrap">
                                {formatCurrencyCompact(r.amount_cents)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="border-t-2 bg-muted/50 font-semibold">
                          <tr>
                            <td className="px-2 py-1.5" colSpan={2}>
                              Totale ({paid.length} rate)
                            </td>
                            <td className="px-2 py-1.5 text-right text-green-600 whitespace-nowrap">
                              {formatCurrencyCompact(paidTotal)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}

                {unpaid.length === 0 && paid.length === 0 && (
                  <div className="text-center text-sm text-muted-foreground py-4">
                    Nessuna rateazione trovata per questo tipo nel mese selezionato.
                  </div>
                )}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function SortableHeader({
  label,
  field,
  currentField,
  currentDir,
  onClick,
  align = 'left',
  className = ''
}: {
  label: string;
  field: 'number' | 'taxpayer' | 'amount';
  currentField: 'number' | 'taxpayer' | 'amount';
  currentDir: 'asc' | 'desc';
  onClick: () => void;
  align?: 'left' | 'right';
  className?: string;
}) {
  const isActive = currentField === field;
  
  return (
    <th
      className={`px-2 py-1 cursor-pointer hover:bg-muted/50 transition-colors select-none ${align === 'right' ? 'text-right' : 'text-left'} ${className}`}
      onClick={onClick}
    >
      <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : 'justify-start'}`}>
        <span>{label}</span>
        {!isActive && <ArrowUpDown size={12} className="text-muted-foreground" />}
        {isActive && currentDir === 'asc' && <ArrowUp size={12} className="text-primary" />}
        {isActive && currentDir === 'desc' && <ArrowDown size={12} className="text-primary" />}
      </div>
    </th>
  );
}

export function MonthBreakdownDrawer({ open, onOpenChange, year, month, groupBy }: Props) {
  const { loading, rows, kpis } = useMonthBreakdown(year, month, groupBy);

  const title = year && month ? `${MONTHS[month - 1]} ${year}` : "Dettaglio mese";

  const chartData = rows.map((r) => ({
    type: labelForType(r.type),
    Pagato: Math.round(r.paid_cents / 100),
    "Non pagato": Math.round(r.unpaid_cents / 100),
    color: getTypeColor(r.type),
  }));

  const deepLink =
    year && month
      ? `/rateazioni?dateFrom=${year}-${String(month).padStart(2, "0")}-01&dateTo=${year}-${String(month).padStart(2, "0")}-${new Date(year, month, 0).getDate()}`
      : "/rateazioni";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[900px] max-w-[95vw] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Dettaglio mese — {title}</SheetTitle>

          {loading && (
            <SheetDescription>
              <div className="mt-2 grid grid-cols-2 gap-3">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            </SheetDescription>
          )}
          {!loading && kpis && (
            <SheetDescription>
              <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
                <KpiCard label="💶 Dovuto" value={formatCurrencyCompact(kpis.due_cents)} />
                <KpiCard
                  label="🟢 Pagato"
                  value={`${formatCurrencyCompact(kpis.paid_cents)} (${formatPercentage(kpis.paid_pct * 100)})`}
                />
                <KpiCard
                  label="🔴 Residuo"
                  value={`${formatCurrencyCompact(kpis.unpaid_cents)} (${formatPercentage(kpis.unpaid_pct * 100)})`}
                />
                <KpiCard label="Periodo" value="1 mese" />
              </div>
            </SheetDescription>
          )}
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Tabella per tipologia */}
          <div>
            <div className="mb-3 text-sm font-medium text-foreground">Per tipologia</div>
            <div className="overflow-hidden rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium min-w-[140px]">Tipo</th>
                    <th className="px-3 py-2 text-right font-medium whitespace-nowrap">🟢 Pagato</th>
                    <th className="px-3 py-2 text-right font-medium whitespace-nowrap">🔴 Non pagato</th>
                    <th className="px-3 py-2 text-right font-medium whitespace-nowrap">Totale</th>
                    <th className="px-3 py-2 text-right font-medium whitespace-nowrap">% Pagato</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={5} className="px-3 py-8">
                        <Skeleton className="h-20 w-full" />
                      </td>
                    </tr>
                  )}
                  {!loading && rows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                        Nessun dato disponibile per questo mese.
                      </td>
                    </tr>
                  )}
                  {!loading && rows.map((r) => <ExpandableTypeRow key={r.type} row={r} year={year} month={month} groupBy={groupBy} />)}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-2 italic">
              💡 Clicca su una riga per espandere e vedere le rateazioni pagate/non pagate
            </p>
          </div>

          {/* Grafico barre impilate */}
          {!loading && rows.length > 0 && (
            <div>
              <div className="mb-3 text-sm font-medium text-foreground">Distribuzione pagamenti</div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <XAxis dataKey="type" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <RTooltip
                      formatter={(v: any) => `${v.toLocaleString("it-IT")} €`}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Pagato" stackId="a" fill="#10b981" />
                    <Bar dataKey="Non pagato" stackId="a" fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* CTA deep-link */}
          <div className="flex items-center justify-end pt-4 border-t">
            <Button variant="outline" size="sm" asChild>
              <a href={deepLink} className="inline-flex items-center gap-2">
                <ExternalLink className="h-4 w-4" />
                Apri elenco rateazioni filtrate
              </a>
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold text-foreground mt-0.5">{value}</div>
    </div>
  );
}

function labelForType(t: string) {
  const map: Record<string, string> = {
    F24: "F24",
    PagoPa: "PagoPA",
    "Rottamazione Quater": "Rott. Quater",
    "Riammissione Quater": "Riam. Quater",
    Altro: "Altro",
  };
  return map[t] || t;
}
