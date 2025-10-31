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

  // Nessuna heatmap - sfondo uniforme bianco

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold">📆 Andamento Mensile — Completo</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1180px] w-full table-fixed border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-white border-b-2 border-gray-200">
            <tr className="text-gray-500">
              <th className="w-16 px-3 py-3 text-left font-medium text-xs">Anno</th>
              {MONTHS.map((m) => (
                <th key={m} className="px-3 py-3 text-right font-medium text-xs border-r border-gray-100">
                  {m}
                </th>
              ))}
              <th className="w-32 px-3 py-3 text-right font-medium text-xs border-r border-gray-100">Totale</th>
              <th className="w-32 px-3 py-3 text-right font-medium text-xs">Media Mensile</th>
            </tr>
          </thead>
          <tbody>
            {years.map((y) => {
              let rowTotal = 0;
              let rowPaid = 0;
              let rowUnpaid = 0;
              return (
                <tr key={y} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-medium text-gray-900 text-sm">{y}</td>
                  {MONTHS.map((_, i) => {
                    const m = i + 1;
                    const cell = matrix.cells.get(`${y}-${m}`);
                    const total = cell?.total_cents ?? 0;
                    const paid = cell?.paid_cents ?? 0;
                    const unpaid = cell?.unpaid_cents ?? 0;
                    rowTotal += total;
                    rowPaid += paid;
                    rowUnpaid += unpaid;

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
                          "select-none px-3 py-2 align-top transition-colors border-r border-gray-100",
                          total > 0
                            ? "cursor-pointer hover:bg-gray-50 bg-white"
                            : "opacity-40 cursor-default bg-white"
                        )}
                      >
                        <div className="text-right font-semibold text-gray-900 text-xs mb-0.5">
                          {formatCurrencyCompact(total)}
                        </div>
                        <div className="text-right text-gray-600 text-[11px]">
                          Pag: {formatCurrencyCompact(paid)}
                        </div>
                        <div className="text-right text-gray-600 text-[11px]">
                          Res: {formatCurrencyCompact(unpaid)}
                        </div>
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 align-top border-r border-gray-100">
                    <div className="text-right font-semibold text-gray-900 text-sm">
                      {formatCurrencyCompact(rowTotal)}
                    </div>
                    <div className="text-right text-gray-600 text-[11px]">
                      Pag: {formatCurrencyCompact(rowPaid)}
                    </div>
                    <div className="text-right text-gray-600 text-[11px]">
                      Res: {formatCurrencyCompact(rowUnpaid)}
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="text-right text-blue-600 text-xs font-medium">
                      Media Tot: {formatCurrencyCompact(rowTotal / 12)}
                    </div>
                    <div className="text-right text-green-600 text-xs">
                      Media Pag: {formatCurrencyCompact(rowPaid / 12)}
                    </div>
                  </td>
                </tr>
              );
            })}

            {/* Riga TOT */}
            <tr className="border-t-2 border-gray-300 bg-gray-50">
              <td className="px-3 py-2 font-semibold text-gray-900 text-xs">TOT</td>
              {MONTHS.map((_, i) => {
                const m = i + 1;
                const sum = years.reduce((acc, y) => {
                  const c = matrix.cells.get(`${y}-${m}`);
                  return acc + (c?.total_cents ?? 0);
                }, 0);
                return (
                  <td key={m} className="px-3 py-2 text-right font-semibold text-gray-900 text-sm border-r border-gray-200">
                    {formatCurrencyCompact(sum)}
                  </td>
                );
              })}
              <td className="px-3 py-2 text-right font-bold text-gray-900 text-sm border-r border-gray-100">
                {formatCurrencyCompact(
                  Array.from(matrix.cells.values()).reduce((a, c) => a + c.total_cents, 0)
                )}
              </td>
              <td className="px-3 py-2 text-right text-gray-600 text-sm">—</td>
            </tr>

            {/* Riga MEDIA */}
            <tr className="border-t border-gray-200 bg-white">
              <td className="px-3 py-2 text-gray-600 text-xs">MEDIA</td>
              {MONTHS.map((_, i) => {
                const m = i + 1;
                const sum = years.reduce((acc, y) => {
                  const c = matrix.cells.get(`${y}-${m}`);
                  return acc + (c?.total_cents ?? 0);
                }, 0);
                const avg = years.length ? sum / years.length : 0;
                return (
                  <td key={m} className="px-3 py-2 text-right text-gray-600 text-sm border-r border-gray-100">
                    {formatCurrencyCompact(avg)}
                  </td>
                );
              })}
              <td className="px-3 py-2 text-right text-gray-600 text-sm border-r border-gray-100">—</td>
              <td className="px-3 py-2 text-right text-gray-600 text-sm">—</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
