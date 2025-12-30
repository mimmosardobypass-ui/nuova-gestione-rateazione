import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import PrintLayout from "@/components/print/PrintLayout";
import { useAllAtRisk } from "@/features/rateations/hooks/useAllAtRisk";
import { QUATER_TOLERANCE_DAYS } from "@/features/rateations/hooks/useQuaterAtRisk";

// Format currency helper
const formatCurrency = (amount: number): string => {
  return amount.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
};

export default function RateazioniAtRisk() {
  const [searchParams] = useSearchParams();
  const theme = searchParams.get("theme") || "bn";
  const density = searchParams.get("density") || "compact";
  const logoUrl = searchParams.get("logo") || undefined;

  const { f24AtRisk, pagopaAtRisk, quaterAtRisk, totalCount, totalResidual, loading, error } = useAllAtRisk();

  // Apply theme classes
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
        // Small buffer for complete rendering
        setTimeout(() => {
          window.focus();
          window.print();
        }, 250);
      };
      go();
    }
  }, [loading, error]);

  // Risk badge helpers
  const getRiskBadgeF24 = (riskLevel: 'critical' | 'warning' | 'info', dueDate: string | null, daysOverdue?: number) => {
    const formattedDate = dueDate 
      ? new Date(dueDate).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })
      : 'N/D';
    
    switch (riskLevel) {
      case 'critical':
        return { label: `🔴 CRITICO${daysOverdue ? ` (${daysOverdue}gg)` : ''} - ${formattedDate}`, class: 'bg-red-100 text-red-800' };
      case 'warning':
        return { label: `🟡 ATTENZIONE - ${formattedDate}`, class: 'bg-yellow-100 text-yellow-800' };
      case 'info':
        return { label: `🔵 PROMEMORIA${daysOverdue ? ` (${daysOverdue}gg)` : ''}`, class: 'bg-blue-100 text-blue-800' };
    }
  };

  const getRiskBadgePagopa = (skipRemaining: number, dueDate: string | null) => {
    const dateStr = dueDate 
      ? ` - ${new Date(dueDate).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}`
      : '';
    
    if (skipRemaining <= 1) return { label: `🔴 CRITICO${dateStr}`, class: 'bg-red-100 text-red-800' };
    if (skipRemaining === 2) return { label: `🟠 ALTO${dateStr}`, class: 'bg-orange-100 text-orange-800' };
    return { label: `🟡 MEDIO${dateStr}`, class: 'bg-yellow-100 text-yellow-800' };
  };

  const getRiskBadgeQuater = (daysToDecadence: number) => {
    if (daysToDecadence <= 0) return { label: `🔴 DECADUTO`, class: 'bg-red-100 text-red-800' };
    if (daysToDecadence <= 5) return { label: `🟠 ${daysToDecadence}gg`, class: 'bg-orange-100 text-orange-800' };
    if (daysToDecadence <= 10) return { label: `🟡 ${daysToDecadence}gg`, class: 'bg-yellow-100 text-yellow-800' };
    return { label: `🟢 ${daysToDecadence}gg`, class: 'bg-green-100 text-green-800' };
  };

  // Calculate KPIs (safe even if data not loaded)
  const avgDaysF24 = f24AtRisk.length > 0
    ? Math.round(f24AtRisk.reduce((sum, f) => sum + (f.daysRemaining || 0), 0) / f24AtRisk.length)
    : 0;

  const avgDaysPagopa = pagopaAtRisk.length > 0
    ? Math.round(pagopaAtRisk.reduce((sum, p) => sum + (p.daysRemaining || 0), 0) / pagopaAtRisk.length)
    : 0;

  const totalSkipPagopa = pagopaAtRisk.reduce((sum, p) => sum + p.skipRemaining, 0);

  // ALWAYS render PrintLayout so session bridge is active
  return (
    <PrintLayout
      title="Rateazioni a Rischio Decadenza"
      subtitle={`Report generato il ${new Date().toLocaleDateString('it-IT')}`}
      logoUrl={logoUrl}
    >
      {/* Loading State - inside PrintLayout so bridge is active */}
      {loading && (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Caricamento dati...</p>
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
          {/* Global KPIs */}
          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-3 border-b pb-2">Riepilogo Generale</h2>
            <div className="grid grid-cols-5 gap-4">
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
              <div className="print-kpi">
                <div className="print-kpi-label">Quater a Rischio</div>
                <div className="print-kpi-value text-amber-600">{quaterAtRisk.length}</div>
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
                    <th className="text-right">Importo Rata</th>
                    <th className="text-right">Rate Scadute</th>
                    <th className="text-right">Giorni Rimanenti</th>
                    <th>Prossima Scadenza</th>
                    <th className="text-center">Livello Rischio</th>
                  </tr>
                </thead>
                <tbody>
                  {f24AtRisk.map((f24) => {
                    const risk = getRiskBadgeF24(f24.riskLevel, f24.nextDueDate, f24.daysOverdue);
                    return (
                      <tr key={f24.rateationId}>
                        <td className="font-mono text-sm">{f24.numero}</td>
                        <td>{f24.contribuente || 'N/A'}</td>
                        <td className="text-right font-semibold">
                          {f24.nextInstallmentAmountCents != null 
                            ? formatCurrency(f24.nextInstallmentAmountCents / 100) 
                            : 'N/D'}
                        </td>
                        <td className="text-right font-semibold">{f24.overdueCount}</td>
                        <td className="text-right font-semibold">{f24.daysRemaining || 0}</td>
                        <td className="font-medium">
                          {f24.nextDueDate 
                            ? new Date(f24.nextDueDate).toLocaleDateString('it-IT')
                            : 'N/D'}
                        </td>
                        <td className="text-center">
                          <span className={`inline-block px-2 py-1 text-xs font-semibold rounded ${risk.class}`}>
                            {risk.label}
                          </span>
                          {f24.overdueCount > 0 && (
                            <div className="mt-0.5 text-[8px] text-gray-700 leading-tight">
                              ✓ {f24.overdueCount} {f24.overdueCount === 1 ? 'rata scaduta' : 'rate scadute'} da {f24.daysOverdue}gg · ✓ Prossima: {f24.daysRemaining}gg · {f24.riskLevel === 'critical' ? '⚠️ A rischio' : '✓ Non a rischio'}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-red-50 font-bold border-t-2">
                    <td colSpan={2} className="text-right">TOTALE F24:</td>
                    <td className="text-right">
                      {formatCurrency(f24AtRisk.reduce((sum, f) => sum + (f.nextInstallmentAmountCents ?? 0), 0) / 100)}
                    </td>
                    <td className="text-right">{f24AtRisk.reduce((sum, f) => sum + f.overdueCount, 0)}</td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
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
              <div className="grid grid-cols-4 gap-4 mb-4">
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
                  <div className="print-kpi-label">Giorni Medi alla Scadenza</div>
                  <div className="print-kpi-value">{avgDaysPagopa}</div>
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
                    <th className="text-right">Importo Rata</th>
                    <th className="text-right">Rate Scadute</th>
                    <th className="text-right">Skip Residui</th>
                    <th className="text-right">Giorni Rimanenti</th>
                    <th>Prossima Scadenza</th>
                    <th className="text-center">Livello Rischio</th>
                  </tr>
                </thead>
                <tbody>
                  {pagopaAtRisk.map((pagopa) => {
                    const risk = getRiskBadgePagopa(pagopa.skipRemaining, pagopa.nextDueDate);
                    return (
                      <tr key={pagopa.rateationId}>
                        <td className="font-mono text-sm">{pagopa.numero}</td>
                        <td>{pagopa.contribuente || 'N/A'}</td>
                        <td className="text-right font-semibold">
                          {pagopa.nextInstallmentAmountCents != null 
                            ? formatCurrency(pagopa.nextInstallmentAmountCents / 100) 
                            : 'N/D'}
                        </td>
                        <td className="text-right font-semibold">{pagopa.unpaidOverdueCount}</td>
                        <td className="text-right font-semibold">{pagopa.skipRemaining}</td>
                        <td className="text-right font-semibold">{pagopa.nextDueDate ? pagopa.daysRemaining : 'N/D'}</td>
                        <td className="font-medium">
                          {pagopa.nextDueDate 
                            ? new Date(pagopa.nextDueDate).toLocaleDateString('it-IT')
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
                </tbody>
                <tfoot>
                  <tr className="bg-orange-50 font-bold border-t-2">
                    <td colSpan={2} className="text-right">TOTALE PagoPA:</td>
                    <td className="text-right">
                      {formatCurrency(pagopaAtRisk.reduce((sum, p) => sum + (p.nextInstallmentAmountCents ?? 0), 0) / 100)}
                    </td>
                    <td className="text-right">{pagopaAtRisk.reduce((sum, p) => sum + p.unpaidOverdueCount, 0)}</td>
                    <td className="text-right">{pagopaAtRisk.reduce((sum, p) => sum + p.skipRemaining, 0)}</td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              </table>
            </section>
          )}

          {/* Quater Section */}
          {quaterAtRisk.length > 0 && (
            <section className="mb-8 avoid-break">
              <h2 className="text-lg font-semibold mb-3 border-b pb-2 text-amber-700">
                Sezione Quater / Riammissione Quater ({quaterAtRisk.length})
              </h2>

              {/* Quater KPIs */}
              <div className="grid grid-cols-4 gap-4 mb-4">
                <div className="print-kpi">
                  <div className="print-kpi-label">Totale Quater a Rischio</div>
                  <div className="print-kpi-value">{quaterAtRisk.length}</div>
                </div>
                <div className="print-kpi">
                  <div className="print-kpi-label">Decadute (0gg o meno)</div>
                  <div className="print-kpi-value text-red-600">
                    {quaterAtRisk.filter(q => q.daysToDecadence <= 0).length}
                  </div>
                </div>
                <div className="print-kpi">
                  <div className="print-kpi-label">Urgenti (1-5gg)</div>
                  <div className="print-kpi-value text-orange-600">
                    {quaterAtRisk.filter(q => q.daysToDecadence > 0 && q.daysToDecadence <= 5).length}
                  </div>
                </div>
                <div className="print-kpi">
                  <div className="print-kpi-label">Giorni Min. alla Decadenza</div>
                  <div className="print-kpi-value">
                    {quaterAtRisk.length > 0 ? Math.min(...quaterAtRisk.map(q => q.daysToDecadence)) : 'N/D'}
                  </div>
                </div>
              </div>

              {/* Quater Table */}
              <table className="print-table">
                <thead>
                  <tr>
                    <th>Numero</th>
                    <th>Tipo</th>
                    <th>Contribuente</th>
                    <th className="text-right">Importo Rata</th>
                    <th>Scadenza Rata</th>
                    <th>Data Decadenza</th>
                    <th className="text-center">Giorni</th>
                    <th className="text-center">Livello Rischio</th>
                  </tr>
                </thead>
                <tbody>
                  {quaterAtRisk.map((q) => {
                    const risk = getRiskBadgeQuater(q.daysToDecadence);
                    return (
                      <tr key={q.rateationId}>
                        <td className="font-mono text-sm">{q.numero}</td>
                        <td className="text-sm">{q.tipoQuater}</td>
                        <td>{q.contribuente || 'N/A'}</td>
                        <td className="text-right font-semibold">
                          {formatCurrency(q.importoRata)}
                        </td>
                        <td>{new Date(q.dueDateRata).toLocaleDateString('it-IT')}</td>
                        <td className="font-semibold">{new Date(q.decadenceDate).toLocaleDateString('it-IT')}</td>
                        <td className="text-center font-bold">
                          {q.daysToDecadence <= 0 ? '❌' : q.daysToDecadence}
                        </td>
                        <td className="text-center">
                          <span className={`inline-block px-2 py-1 text-xs font-semibold rounded ${risk.class}`}>
                            {risk.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-amber-50 font-bold border-t-2">
                    <td colSpan={3} className="text-right">TOTALE Quater:</td>
                    <td className="text-right">{formatCurrency(quaterAtRisk.reduce((sum, q) => sum + q.importoRata, 0))}</td>
                    <td colSpan={4}></td>
                  </tr>
                </tfoot>
              </table>
            </section>
          )}

          {/* Riepilogo Totali */}
          <section className="mb-8 avoid-break">
            <h2 className="text-lg font-semibold mb-3 border-b pb-2 text-slate-700">
              Riepilogo Totali
            </h2>
            <table className="print-table">
              <thead>
                <tr>
                  <th>Tipologia</th>
                  <th className="text-right">Numero</th>
                  <th className="text-right">Importo Rate</th>
                  <th className="text-right">Rate Scadute</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="font-semibold text-red-700">F24</td>
                  <td className="text-right">{f24AtRisk.length}</td>
                  <td className="text-right font-semibold">
                    {formatCurrency(f24AtRisk.reduce((sum, f) => sum + (f.nextInstallmentAmountCents ?? 0), 0) / 100)}
                  </td>
                  <td className="text-right">{f24AtRisk.reduce((sum, f) => sum + f.overdueCount, 0)}</td>
                </tr>
                <tr>
                  <td className="font-semibold text-orange-700">PagoPA</td>
                  <td className="text-right">{pagopaAtRisk.length}</td>
                  <td className="text-right font-semibold">
                    {formatCurrency(pagopaAtRisk.reduce((sum, p) => sum + (p.nextInstallmentAmountCents ?? 0), 0) / 100)}
                  </td>
                  <td className="text-right">{pagopaAtRisk.reduce((sum, p) => sum + p.unpaidOverdueCount, 0)}</td>
                </tr>
                <tr>
                  <td className="font-semibold text-amber-700">Quater</td>
                  <td className="text-right">{quaterAtRisk.length}</td>
                  <td className="text-right font-semibold">
                    {formatCurrency(quaterAtRisk.reduce((sum, q) => sum + q.importoRata, 0))}
                  </td>
                  <td className="text-right">-</td>
                </tr>
              </tbody>
              <tfoot>
                <tr className="border-t-2 font-bold bg-slate-100">
                  <td>TOTALE</td>
                  <td className="text-right">{totalCount}</td>
                  <td className="text-right">
                    {formatCurrency(
                      (f24AtRisk.reduce((sum, f) => sum + (f.nextInstallmentAmountCents ?? 0), 0) / 100) +
                      (pagopaAtRisk.reduce((sum, p) => sum + (p.nextInstallmentAmountCents ?? 0), 0) / 100) +
                      quaterAtRisk.reduce((sum, q) => sum + q.importoRata, 0)
                    )}
                  </td>
                  <td className="text-right">
                    {f24AtRisk.reduce((sum, f) => sum + f.overdueCount, 0) + 
                     pagopaAtRisk.reduce((sum, p) => sum + p.unpaidOverdueCount, 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </section>

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
            <div className="grid grid-cols-3 gap-4 text-xs text-muted-foreground">
              <div>
                <strong>F24:</strong>
                <ul className="mt-1 space-y-1">
                  <li>• 🔴 CRITICO: Rate scadute + prossima ≤20gg</li>
                  <li>• 🟡 ATTENZIONE: Scadenza ≤30gg</li>
                  <li>• 🔵 PROMEMORIA: Rate scadute, &gt;30gg</li>
                </ul>
              </div>
              <div>
                <strong>PagoPA:</strong>
                <ul className="mt-1 space-y-1">
                  <li>• 🔴 CRITICO: Skip ≤1</li>
                  <li>• 🟠 ALTO: Skip = 2</li>
                  <li>• 🟡 MEDIO: Skip ≥3</li>
                </ul>
              </div>
              <div>
                <strong>Quater (tolleranza {QUATER_TOLERANCE_DAYS}gg):</strong>
                <ul className="mt-1 space-y-1">
                  <li>• 🔴 DECADUTO: 0gg o meno</li>
                  <li>• 🟠 URGENTE: 1-5gg</li>
                  <li>• 🟡 ATTENZIONE: 6-10gg</li>
                  <li>• 🟢 OK: &gt;10gg</li>
                </ul>
              </div>
            </div>
          </section>
        </>
      )}
    </PrintLayout>
  );
}
