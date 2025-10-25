import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import PrintLayout from "@/components/print/PrintLayout";
import { useF24AtRisk } from "@/features/rateations/hooks/useF24AtRisk";

const formatCurrency = (amount: number): string => {
  return amount.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
};

export default function F24AtRisk() {
  const [searchParams] = useSearchParams();
  const theme = searchParams.get("theme") || "bn";
  const density = searchParams.get("density") || "compact";
  const logoUrl = searchParams.get("logo") || undefined;

  const { atRiskF24s, loading, error } = useF24AtRisk();

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
          <p className="text-muted-foreground">Caricamento dati F24...</p>
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

  const avgDaysF24 = atRiskF24s.length > 0
    ? Math.round(atRiskF24s.reduce((sum, f) => sum + (f.daysRemaining || 0), 0) / atRiskF24s.length)
    : 0;

  const getRiskBadge = (days: number) => {
    if (days <= 7) return { label: 'CRITICO', class: 'bg-red-100 text-red-800' };
    if (days <= 14) return { label: 'ALTO', class: 'bg-orange-100 text-orange-800' };
    return { label: 'MEDIO', class: 'bg-yellow-100 text-yellow-800' };
  };

  return (
    <PrintLayout
      title="Report F24 a Rischio Decadenza"
      subtitle={`Report generato il ${new Date().toLocaleDateString('it-IT')}`}
      logoUrl={logoUrl}
    >
      {/* KPIs */}
      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-3 border-b pb-2">Riepilogo F24</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="print-kpi">
            <div className="print-kpi-label">Totale F24 a Rischio</div>
            <div className="print-kpi-value text-red-600">{atRiskF24s.length}</div>
          </div>
          <div className="print-kpi">
            <div className="print-kpi-label">Giorni Medi al Prossimo Pagamento</div>
            <div className="print-kpi-value">{avgDaysF24}</div>
          </div>
          <div className="print-kpi">
            <div className="print-kpi-label">Rate Scadute (Media)</div>
            <div className="print-kpi-value">
              {atRiskF24s.length > 0
                ? Math.round(atRiskF24s.reduce((sum, f) => sum + f.overdueCount, 0) / atRiskF24s.length)
                : 0}
            </div>
          </div>
        </div>
      </section>

      {/* F24 Table */}
      {atRiskF24s.length > 0 ? (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3 border-b pb-2">Dettaglio F24 a Rischio</h2>
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
              {atRiskF24s.map((f24) => {
                const risk = getRiskBadge(f24.daysRemaining || 0);
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
      ) : (
        <div className="text-center py-12">
          <p className="text-lg text-muted-foreground">Nessun F24 a rischio decadenza</p>
        </div>
      )}

      {/* Legend */}
      <section className="mt-8 border-t pt-4">
        <h3 className="text-sm font-semibold mb-2">Legenda Livelli di Rischio F24</h3>
        <ul className="space-y-1 text-xs text-muted-foreground">
          <li>• <strong>CRITICO:</strong> Giorni al prossimo pagamento ≤ 7</li>
          <li>• <strong>ALTO:</strong> Giorni al prossimo pagamento 8-14</li>
          <li>• <strong>MEDIO:</strong> Giorni al prossimo pagamento 15-20</li>
        </ul>
      </section>
    </PrintLayout>
  );
}
