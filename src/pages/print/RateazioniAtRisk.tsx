import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import PrintLayout from "@/components/print/PrintLayout";
import { useAllAtRisk } from "@/features/rateations/hooks/useAllAtRisk";

// Format currency helper
const formatCurrency = (amount: number): string => {
  return amount.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
};

export default function RateazioniAtRisk() {
  const [searchParams] = useSearchParams();
  const theme = searchParams.get("theme") || "bn";
  const density = searchParams.get("density") || "compact";
  const logoUrl = searchParams.get("logo") || undefined;

  const { f24AtRisk, pagopaAtRisk, totalCount, totalResidual, loading, error } = useAllAtRisk();

  // Apply theme classes
  useEffect(() => {
    document.body.className = `theme-${theme} density-${density}`;
  }, [theme, density]);

  // Auto-print when data is loaded
  useEffect(() => {
    if (!loading) {
      const go = async () => {
        try { 
          await (document as any).fonts?.ready; 
        } catch {}
        // Small buffer for complete rendering
        setTimeout(() => {
          window.focus();
          window.print();
        }, 250);
      };
      go();
    }
  }, [loading]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Caricamento dati...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-destructive font-semibold">Errore caricamento dati</p>
          <p className="text-sm text-muted-foreground mt-2">{error}</p>
        </div>
      </div>
    );
  }

  // Calculate KPIs
  const avgDaysF24 = f24AtRisk.length > 0
    ? Math.round(f24AtRisk.reduce((sum, f) => sum + (f.daysRemaining || 0), 0) / f24AtRisk.length)
    : 0;

  const totalSkipPagopa = pagopaAtRisk.reduce((sum, p) => sum + p.skipRemaining, 0);

  // Risk badge helper
  const getRiskBadge = (type: 'f24' | 'pagopa', value: number) => {
    if (type === 'f24') {
      if (value <= 7) return { label: 'CRITICO', class: 'bg-red-100 text-red-800' };
      if (value <= 14) return { label: 'ALTO', class: 'bg-orange-100 text-orange-800' };
      return { label: 'MEDIO', class: 'bg-yellow-100 text-yellow-800' };
    } else {
      if (value <= 1) return { label: 'CRITICO', class: 'bg-red-100 text-red-800' };
      if (value === 2) return { label: 'ALTO', class: 'bg-orange-100 text-orange-800' };
      return { label: 'MEDIO', class: 'bg-yellow-100 text-yellow-800' };
    }
  };

  return (
    <PrintLayout
      title="Rateazioni a Rischio Decadenza"
      subtitle={`Report generato il ${new Date().toLocaleDateString('it-IT')}`}
      logoUrl={logoUrl}
    >
      {/* Global KPIs */}
      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-3 border-b pb-2">Riepilogo Generale</h2>
        <div className="grid grid-cols-4 gap-4">
          <div className="print-kpi">
            <div className="print-kpi-label">Totale Rateazioni</div>
            <div className="print-kpi-value">{totalCount}</div>
          </div>
          <div className="print-kpi">
            <div className="print-kpi-label">Importo Residuo Totale</div>
            <div className="print-kpi-value">{formatCurrency(Number(totalResidual))}</div>
          </div>
          <div className="print-kpi">
            <div className="print-kpi-label">F24 a Rischio</div>
            <div className="print-kpi-value text-red-600">{f24AtRisk.length}</div>
          </div>
          <div className="print-kpi">
            <div className="print-kpi-label">PagoPA a Rischio</div>
            <div className="print-kpi-value text-orange-600">{pagopaAtRisk.length}</div>
          </div>
        </div>
      </section>

      {/* F24 Section */}
      {f24AtRisk.length > 0 && (
        <section className="mb-8 avoid-break">
          <h2 className="text-lg font-semibold mb-3 border-b pb-2 text-red-700">
            Sezione F24 ({f24AtRisk.length})
          </h2>

          {/* F24 KPIs */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="print-kpi">
              <div className="print-kpi-label">Giorni Medi al Prossimo Pagamento</div>
              <div className="print-kpi-value">{avgDaysF24}</div>
            </div>
            <div className="print-kpi">
              <div className="print-kpi-label">Rate Scadute Non Pagate (Media)</div>
              <div className="print-kpi-value">
                {f24AtRisk.length > 0
                  ? Math.round(f24AtRisk.reduce((sum, f) => sum + f.overdueCount, 0) / f24AtRisk.length)
                  : 0}
              </div>
            </div>
            <div className="print-kpi">
              <div className="print-kpi-label">Totale F24</div>
              <div className="print-kpi-value">{f24AtRisk.length}</div>
            </div>
          </div>

          {/* F24 Table */}
          <table className="print-table">
            <thead>
              <tr>
                <th>Numero</th>
                <th>Contribuente</th>
                <th className="text-right">Rate Scadute</th>
                <th className="text-right">Giorni al Prossimo</th>
                <th className="text-center">Livello Rischio</th>
              </tr>
            </thead>
            <tbody>
              {f24AtRisk.map((f24) => {
                const risk = getRiskBadge('f24', f24.daysRemaining || 0);
                return (
                  <tr key={f24.rateationId}>
                    <td className="font-mono text-sm">{f24.numero}</td>
                    <td>{f24.contribuente || 'N/A'}</td>
                    <td className="text-right font-semibold">{f24.overdueCount}</td>
                    <td className="text-right font-semibold">{f24.daysRemaining || 0}</td>
                    <td className="text-center">
                      <span className={`inline-block px-2 py-1 text-xs font-semibold rounded ${risk.class}`}>
                        {risk.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {/* PagoPA Section */}
      {pagopaAtRisk.length > 0 && (
        <section className="mb-8 avoid-break">
          <h2 className="text-lg font-semibold mb-3 border-b pb-2 text-orange-700">
            Sezione PagoPA ({pagopaAtRisk.length})
          </h2>

          {/* PagoPA KPIs */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="print-kpi">
              <div className="print-kpi-label">Skip Residui Totali</div>
              <div className="print-kpi-value">{totalSkipPagopa}</div>
            </div>
            <div className="print-kpi">
              <div className="print-kpi-label">Rate Scadute Non Pagate (Totale)</div>
              <div className="print-kpi-value">
                {pagopaAtRisk.reduce((sum, p) => sum + p.unpaidOverdueCount, 0)}
              </div>
            </div>
            <div className="print-kpi">
              <div className="print-kpi-label">Totale PagoPA</div>
              <div className="print-kpi-value">{pagopaAtRisk.length}</div>
            </div>
          </div>

          {/* PagoPA Table */}
          <table className="print-table">
            <thead>
              <tr>
                <th>Numero</th>
                <th>Contribuente</th>
                <th className="text-right">Rate Scadute</th>
                <th className="text-right">Skip Residui</th>
                <th className="text-center">Livello Rischio</th>
              </tr>
            </thead>
            <tbody>
              {pagopaAtRisk.map((pagopa) => {
                const risk = getRiskBadge('pagopa', pagopa.skipRemaining);
                return (
                  <tr key={pagopa.rateationId}>
                    <td className="font-mono text-sm">{pagopa.numero}</td>
                    <td>{pagopa.contribuente || 'N/A'}</td>
                    <td className="text-right font-semibold">{pagopa.unpaidOverdueCount}</td>
                    <td className="text-right font-semibold">{pagopa.skipRemaining}</td>
                    <td className="text-center">
                      <span className={`inline-block px-2 py-1 text-xs font-semibold rounded ${risk.class}`}>
                        {risk.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {/* Empty State */}
      {totalCount === 0 && (
        <div className="text-center py-12">
          <p className="text-lg text-muted-foreground">Nessuna rateazione a rischio decadenza</p>
          <p className="text-sm text-muted-foreground mt-2">
            Tutte le rateazioni sono in regola con i pagamenti
          </p>
        </div>
      )}

      {/* Legend */}
      <section className="mt-8 border-t pt-4">
        <h3 className="text-sm font-semibold mb-2">Legenda Livelli di Rischio</h3>
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <p className="font-semibold mb-1">F24:</p>
            <ul className="space-y-1 text-muted-foreground">
              <li>• <strong>CRITICO:</strong> Giorni al prossimo pagamento ≤ 7</li>
              <li>• <strong>ALTO:</strong> Giorni al prossimo pagamento 8-14</li>
              <li>• <strong>MEDIO:</strong> Giorni al prossimo pagamento 15-20</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold mb-1">PagoPA:</p>
            <ul className="space-y-1 text-muted-foreground">
              <li>• <strong>CRITICO:</strong> Skip residui ≤ 1</li>
              <li>• <strong>ALTO:</strong> Skip residui = 2</li>
              <li>• <strong>MEDIO:</strong> Skip residui ≥ 3</li>
            </ul>
          </div>
        </div>
      </section>
    </PrintLayout>
  );
}
