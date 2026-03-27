import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import PrintLayout from "@/components/print/PrintLayout";
import { usePagopaAtRisk } from "@/features/rateations/hooks/usePagopaAtRisk";
import { usePagopaUpcoming } from "@/features/rateations/hooks/usePagopaUpcoming";

const formatCurrency = (amount: number): string => {
  return amount.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
};

export default function PagopaAtRisk() {
  const [searchParams] = useSearchParams();
  const theme = searchParams.get("theme") || "bn";
  const density = searchParams.get("density") || "compact";
  const logoUrl = searchParams.get("logo") || undefined;

  const { atRiskPagopas, loading: loadingCritical, error: errorCritical } = usePagopaAtRisk();
  const { upcomingPagopas, loading: loadingUpcoming, error: errorUpcoming } = usePagopaUpcoming();
  const loading = loadingCritical || loadingUpcoming;
  const error = errorCritical || errorUpcoming;

  useEffect(() => {
    document.body.className = `theme-${theme} density-${density}`;
  }, [theme, density]);

  // Auto-print ONLY when data is loaded AND no error
  useEffect(() => {
    if (!loading && !error) {
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
  }, [loading, error]);

  const totalSkipPagopa = atRiskPagopas.reduce((sum, p) => sum + p.skipRemaining, 0);
  const totalOverdueCount = atRiskPagopas.reduce((sum, p) => sum + p.unpaidOverdueCount, 0);

  const avgDaysRemaining = atRiskPagopas.length > 0
    ? Math.round(atRiskPagopas.reduce((sum, p) => sum + (p.daysRemaining || 0), 0) / atRiskPagopas.length)
    : 0;

  const totalInstallmentsAmount = atRiskPagopas.reduce((sum, p) => 
    sum + (p.nextInstallmentAmountCents ?? 0), 0
  );

  const getRiskBadge = (skipRemaining: number, dueDate: string | null) => {
    const dateStr = dueDate 
      ? ` - Entro ${new Date(dueDate).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}`
      : '';
    
    if (skipRemaining <= 1) return { label: `🔴 LIMITE RAGGIUNTO${dateStr}`, class: 'bg-red-100 text-red-800' };
    if (skipRemaining === 2) return { label: `🟠 ULTIMO SALTO${dateStr}`, class: 'bg-orange-100 text-orange-800' };
    return { label: `🟡 ${skipRemaining} SALTI${dateStr}`, class: 'bg-yellow-100 text-yellow-800' };
  };

  // ALWAYS render PrintLayout so session bridge is active
  return (
    <PrintLayout
      title="Report PagoPA a Rischio Decadenza"
      subtitle={`Report generato il ${new Date().toLocaleDateString('it-IT')}`}
      logoUrl={logoUrl}
    >
      {/* Loading State - inside PrintLayout so bridge is active */}
      {loading && (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Caricamento dati PagoPA...</p>
          </div>
        </div>
      )}

      {/* Error State - inside PrintLayout so bridge is active */}
      {!loading && error && (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <p className="text-destructive font-semibold">
              {error.toLowerCase().includes('auth') || 
               error.toLowerCase().includes('session') ||
               error.toLowerCase().includes('jwt') 
                ? 'Sessione scaduta' 
                : 'Errore caricamento dati'}
            </p>
            <p className="text-sm text-muted-foreground">{error}</p>
            <button 
              onClick={() => window.close()} 
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Chiudi finestra
            </button>
          </div>
        </div>
      )}

      {/* Data Content - only when loaded and no error */}
      {!loading && !error && (
        <>
          {/* KPIs */}
          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-3 border-b pb-2">Riepilogo PagoPA</h2>
            <div className="grid grid-cols-4 gap-4">
              <div className="print-kpi">
                <div className="print-kpi-label">Totale PagoPA a Rischio</div>
                <div className="print-kpi-value text-orange-600">{atRiskPagopas.length}</div>
              </div>
              <div className="print-kpi">
                <div className="print-kpi-label">Skip Residui Totali</div>
                <div className="print-kpi-value">{totalSkipPagopa}</div>
              </div>
              <div className="print-kpi">
                <div className="print-kpi-label">Rate Scadute Totali</div>
                <div className="print-kpi-value">{totalOverdueCount}</div>
              </div>
              <div className="print-kpi">
                <div className="print-kpi-label">Giorni Medi alla Scadenza</div>
                <div className="print-kpi-value">{avgDaysRemaining}</div>
              </div>
            </div>
          </section>

          {/* PagoPA Table */}
          {atRiskPagopas.length > 0 ? (
            <section className="mb-8">
              <h2 className="text-lg font-semibold mb-3 border-b pb-2">Dettaglio PagoPA a Rischio</h2>
              <table className="print-table">
                <thead>
                  <tr>
                    <th>Numero</th>
                    <th>Contribuente</th>
                    <th className="text-right">Rate Scadute</th>
                    <th className="text-right">Skip Residui</th>
                    <th className="text-right">Giorni Rimanenti</th>
                    <th>Prossima Scadenza</th>
                    <th className="text-right">Importo Rata</th>
                    <th className="text-center">Livello Rischio</th>
                  </tr>
                </thead>
                <tbody>
                  {atRiskPagopas.map((pagopa) => {
                    const risk = getRiskBadge(pagopa.skipRemaining, pagopa.nextDueDate);
                    return (
                      <tr key={pagopa.rateationId}>
                        <td className="font-mono text-sm">{pagopa.numero}</td>
                        <td>{pagopa.contribuente || 'N/A'}</td>
                        <td className="text-right font-semibold">{pagopa.unpaidOverdueCount}</td>
                        <td className="text-right font-semibold">{pagopa.skipRemaining}</td>
                        <td className="text-right font-semibold">{pagopa.nextDueDate ? pagopa.daysRemaining : 'N/D'}</td>
                        <td className="font-medium">
                          {pagopa.nextDueDate 
                            ? new Date(pagopa.nextDueDate).toLocaleDateString('it-IT')
                            : 'N/D'}
                        </td>
                        <td className="text-right font-semibold">
                          {pagopa.nextInstallmentAmountCents !== null
                            ? formatCurrency(pagopa.nextInstallmentAmountCents / 100)
                            : 'N/D'}
                        </td>
                        <td className="text-center">
                          <span className={`inline-block px-2 py-1 text-xs font-semibold rounded ${risk.class}`}>
                            {risk.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {/* Riga Totale */}
                  <tr className="border-t-2 border-gray-400 font-bold bg-gray-50">
                    <td colSpan={6} className="text-right pr-4 py-3">
                      TOTALE RATE:
                    </td>
                    <td className="text-right font-bold text-lg text-blue-600">
                      {formatCurrency(totalInstallmentsAmount / 100)}
                    </td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </section>
          ) : (
            <div className="text-center py-12">
              <p className="text-lg text-muted-foreground">Nessun PagoPA a rischio decadenza</p>
            </div>
          )}

          {/* Upcoming Section */}
          {upcomingPagopas.length > 0 && (
            <section className="mb-8">
              <h2 className="text-lg font-semibold mb-3 border-b pb-2 text-blue-700">
                Prossime Scadenze (30gg) - {upcomingPagopas.length} PagoPA
              </h2>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="print-kpi">
                  <div className="print-kpi-label">Totale</div>
                  <div className="print-kpi-value">{upcomingPagopas.length}</div>
                </div>
                <div className="print-kpi">
                  <div className="print-kpi-label">Prime Rate (Tassative)</div>
                  <div className="print-kpi-value text-red-600">
                    {upcomingPagopas.filter(p => p.isFirstInstallment).length}
                  </div>
                </div>
                <div className="print-kpi">
                  <div className="print-kpi-label">Giorni Min.</div>
                  <div className="print-kpi-value">
                    {Math.min(...upcomingPagopas.map(p => p.daysRemaining))}
                  </div>
                </div>
              </div>
              <table className="print-table">
                <thead>
                  <tr>
                    <th>Numero</th>
                    <th>Contribuente</th>
                    <th className="text-right">Importo Rata</th>
                    <th>Scadenza</th>
                    <th className="text-right">Giorni</th>
                    <th className="text-center">Rischio</th>
                  </tr>
                </thead>
                <tbody>
                  {upcomingPagopas.map((p) => {
                    const badge = p.isFirstInstallment
                      ? { label: '🔴 PRIMA RATA', class: 'bg-red-100 text-red-800' }
                      : p.daysRemaining <= 7
                        ? { label: '🟡 ATTENZIONE', class: 'bg-yellow-100 text-yellow-800' }
                        : { label: '🟢 PROMEMORIA', class: 'bg-green-100 text-green-800' };
                    return (
                      <tr key={p.rateationId}>
                        <td className="font-mono text-sm">{p.numero}</td>
                        <td>{p.contribuente || 'N/A'}</td>
                        <td className="text-right font-semibold">
                          {p.amountCents != null ? formatCurrency(p.amountCents / 100) : 'N/D'}
                        </td>
                        <td>{new Date(p.nextDueDate).toLocaleDateString('it-IT')}</td>
                        <td className="text-right font-semibold">{p.daysRemaining}</td>
                        <td className="text-center">
                          <span className={`inline-block px-2 py-1 text-xs font-semibold rounded ${badge.class}`}>
                            {badge.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          )}

          {/* Legend */}
          <section className="mt-8 border-t pt-4">
            <h3 className="text-sm font-semibold mb-2">Legenda Livelli di Rischio PagoPA</h3>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li>• <strong>CRITICO:</strong> Skip residui ≤ 1</li>
              <li>• <strong>ALTO:</strong> Skip residui = 2</li>
              <li>• <strong>MEDIO:</strong> Skip residui ≥ 3</li>
              <li>• <strong>PRIMA RATA:</strong> Rata n.1 non pagata e in scadenza entro 30gg (tassativa)</li>
              <li>• <strong>ATTENZIONE:</strong> Scadenza entro 7gg</li>
              <li>• <strong>PROMEMORIA:</strong> Scadenza entro 8-30gg</li>
            </ul>
          </section>
        </>
      )}
    </PrintLayout>
  );
}
