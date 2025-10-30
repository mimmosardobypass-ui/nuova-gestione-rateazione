import { cn } from "@/lib/utils";
import { useMonthlyEvolution } from "../../hooks/useMonthlyEvolution";
import { formatCurrencyCompact } from "../../utils/statsV3Formatters";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

type Props = {
  yearFrom: number;
  yearTo: number;
  onSelectMonth: (y: number, m: number) => void;
};

const MONTHS = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

export function MonthlyTrendMatrix({ yearFrom, yearTo, onSelectMonth }: Props) {
  const { loading, error, matrix } = useMonthlyEvolution({ yearFrom, yearTo });

  if (loading) {
    return <Skeleton className="h-[500px]" />;
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Errore nel caricamento della matrice mensile: {error}</AlertDescription>
      </Alert>
    );
  }

  const years = matrix.years;
  if (years.length === 0) {
    return (
      <div className="rounded-2xl border bg-card p-6 text-center text-muted-foreground">
        Nessun dato disponibile per il periodo selezionato.
      </div>
    );
  }

  // Calcolo min/max per heatmap
  const totals = Array.from(matrix.cells.values()).map((c) => c.total_cents);
  const min = Math.min(...totals, 0);
  const max = Math.max(...totals, 1);

  const bgFor = (v: number) => {
    if (v === 0) return "bg-slate-50";
    const t = (v - min) / (max - min);
    const steps = [
      "bg-slate-50",
      "bg-blue-50",
      "bg-blue-100",
      "bg-blue-200",
      "bg-blue-300",
      "bg-blue-400/40",
    ];
    return steps[Math.min(steps.length - 1, Math.max(0, Math.floor(t * steps.length)))];
  };

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold">📆 Andamento Mensile — Completo</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[980px] w-full table-fixed border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-card">
            <tr className="text-muted-foreground">
              <th className="w-16 px-2 py-2 text-left font-medium">Anno</th>
              {MONTHS.map((m) => (
                <th key={m} className="px-2 py-2 text-right font-medium">
                  {m}
                </th>
              ))}
              <th className="w-24 px-2 py-2 text-right font-medium">Totale</th>
            </tr>
          </thead>
          <tbody>
            {years.map((y) => {
              let rowTotal = 0;
              return (
                <tr key={y} className="border-t">
                  <td className="px-2 py-1 font-medium text-foreground">{y}</td>
                  {MONTHS.map((_, i) => {
                    const m = i + 1;
                    const cell = matrix.cells.get(`${y}-${m}`);
                    const total = cell?.total_cents ?? 0;
                    const paid = cell?.paid_cents ?? 0;
                    const unpaid = cell?.unpaid_cents ?? 0;
                    rowTotal += total;
                    const bg = bgFor(total);

                    return (
                      <td
                        key={m}
                        role="button"
                        tabIndex={total > 0 ? 0 : -1}
                        aria-label={`Dettaglio ${MONTHS[i]} ${y}`}
                        onClick={() => total > 0 && onSelectMonth(y, m)}
                        onKeyDown={(e) => {
                          if ((e.key === "Enter" || e.key === " ") && total > 0) {
                            e.preventDefault();
                            onSelectMonth(y, m);
                          }
                        }}
                        className={cn(
                          "select-none px-2 py-1 align-top transition-colors",
                          bg,
                          total > 0
                            ? "cursor-pointer hover:outline hover:outline-1 hover:outline-primary focus:outline focus:outline-2 focus:outline-primary"
                            : "opacity-60 cursor-default"
                        )}
                      >
                        <div className="text-right font-semibold text-foreground text-xs">
                          💶 {formatCurrencyCompact(total)}
                        </div>
                        <div className="text-right text-green-600 text-xs">
                          Pagato: {formatCurrencyCompact(paid)}
                        </div>
                        <div className="text-right text-red-500 text-xs">
                          Residuo: {formatCurrencyCompact(unpaid)}
                        </div>
                      </td>
                    );
                  })}
                  <td className="px-2 py-1 text-right font-semibold text-foreground">
                    {formatCurrencyCompact(rowTotal)}
                  </td>
                </tr>
              );
            })}

            {/* Riga TOT */}
            <tr className="border-t bg-muted/50">
              <td className="px-2 py-1 font-semibold">TOT</td>
              {MONTHS.map((_, i) => {
                const m = i + 1;
                const sum = years.reduce((acc, y) => {
                  const c = matrix.cells.get(`${y}-${m}`);
                  return acc + (c?.total_cents ?? 0);
                }, 0);
                return (
                  <td key={m} className="px-2 py-1 text-right font-semibold text-sm">
                    {formatCurrencyCompact(sum)}
                  </td>
                );
              })}
              <td className="px-2 py-1 text-right font-bold">
                {formatCurrencyCompact(
                  Array.from(matrix.cells.values()).reduce((a, c) => a + c.total_cents, 0)
                )}
              </td>
            </tr>

            {/* Riga MEDIA */}
            <tr className="border-t">
              <td className="px-2 py-1 text-muted-foreground">MEDIA</td>
              {MONTHS.map((_, i) => {
                const m = i + 1;
                const sum = years.reduce((acc, y) => {
                  const c = matrix.cells.get(`${y}-${m}`);
                  return acc + (c?.total_cents ?? 0);
                }, 0);
                const avg = years.length ? sum / years.length : 0;
                return (
                  <td key={m} className="px-2 py-1 text-right text-muted-foreground text-sm">
                    {formatCurrencyCompact(avg)}
                  </td>
                );
              })}
              <td className="px-2 py-1 text-right text-muted-foreground">—</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
