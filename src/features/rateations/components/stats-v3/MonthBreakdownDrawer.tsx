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
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
};

const MONTHS = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

function ExpandableTypeRow({
  row,
  year,
  month,
}: {
  row: { type: string; paid_cents: number; unpaid_cents: number; total_cents: number; paid_pct: number };
  year: number | null;
  month: number | null;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const { loading, paid, unpaid } = useRateationsDetailForMonth(
    isOpen ? year : null,
    isOpen ? month : null,
    isOpen ? row.type : null
  );

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <tr className="border-t hover:bg-muted/50 cursor-pointer transition-colors">
          <td className="px-3 py-2">
            <div className="flex items-center gap-2">
              {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <span
                className="inline-block w-3 h-3 rounded-full"
                style={{ backgroundColor: getTypeColor(row.type) }}
              />
              {labelForType(row.type)}
            </div>
          </td>
          <td className="px-3 py-2 text-right text-green-600">
            {formatCurrencyCompact(row.paid_cents)}
          </td>
          <td className="px-3 py-2 text-right text-red-500">
            {formatCurrencyCompact(row.unpaid_cents)}
          </td>
          <td className="px-3 py-2 text-right font-medium">
            {formatCurrencyCompact(row.total_cents)}
          </td>
          <td className="px-3 py-2 text-right">{formatPercentage(row.paid_pct * 100)}</td>
        </tr>
      </CollapsibleTrigger>
      <CollapsibleContent asChild>
        <tr className="border-t bg-muted/20">
          <td colSpan={5} className="p-4">
            {loading && <Skeleton className="h-32 w-full" />}
            {!loading && (
              <div className="space-y-4">
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
                            <th className="px-2 py-1 text-left">N. Rateazione</th>
                            <th className="px-2 py-1 text-left">Contribuente</th>
                            <th className="px-2 py-1 text-right">Residuo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {unpaid.map((r) => (
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
                              <td className="px-2 py-1.5">{r.taxpayer_name || "—"}</td>
                              <td className="px-2 py-1.5 text-right font-medium text-red-600">
                                {formatCurrencyCompact(r.residual_cents)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
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
                            <th className="px-2 py-1 text-left">N. Rateazione</th>
                            <th className="px-2 py-1 text-left">Contribuente</th>
                            <th className="px-2 py-1 text-right">Importo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paid.map((r) => (
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
                              <td className="px-2 py-1.5">{r.taxpayer_name || "—"}</td>
                              <td className="px-2 py-1.5 text-right font-medium text-green-600">
                                {formatCurrencyCompact(r.amount_cents)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
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
      </CollapsibleContent>
    </Collapsible>
  );
}

export function MonthBreakdownDrawer({ open, onOpenChange, year, month }: Props) {
  const { loading, rows, kpis } = useMonthBreakdown(year, month);

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
      <SheetContent side="right" className="w-[760px] max-w-[92vw] overflow-y-auto">
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
              <table className="w-full table-fixed text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Tipo</th>
                    <th className="px-3 py-2 text-right font-medium">🟢 Pagato</th>
                    <th className="px-3 py-2 text-right font-medium">🔴 Non pagato</th>
                    <th className="px-3 py-2 text-right font-medium">Totale</th>
                    <th className="px-3 py-2 text-right font-medium">% Pagato</th>
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
                  {!loading && rows.map((r) => <ExpandableTypeRow key={r.type} row={r} year={year} month={month} />)}
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
