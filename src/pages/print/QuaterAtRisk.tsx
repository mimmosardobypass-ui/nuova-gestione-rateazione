import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import PrintLayout from "@/components/print/PrintLayout";
import { useQuaterAtRisk, QUATER_TOLERANCE_DAYS, QUATER_VISIBILITY_WINDOW } from "@/features/rateations/hooks/useQuaterAtRisk";

const formatCurrency = (amount: number): string => {
  return amount.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
};

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });

export default function QuaterAtRisk() {
  const [searchParams] = useSearchParams();
  const theme = searchParams.get("theme") || "bn";
  const density = searchParams.get("density") || "compact";
  const logoUrl = searchParams.get("logo") || undefined;

  const { atRiskQuaters, loading, error } = useQuaterAtRisk();

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
        setTimeout(() => {
          window.focus();
          window.print();
        }, 250);
      };
      go();
    }
  }, [loading, error]);

  // Separa per livello (safe even if data not loaded)
  const critical = atRiskQuaters.filter(q => q.riskLevel === 'critical');
  const warning = atRiskQuaters.filter(q => q.riskLevel === 'warning');
  const caution = atRiskQuaters.filter(q => q.riskLevel === 'caution');
  const ok = atRiskQuaters.filter(q => q.riskLevel === 'ok');

  // Totali
  const totalAmount = atRiskQuaters.reduce((sum, q) => sum + q.importoRata, 0);
  const minDays = atRiskQuaters.length > 0 
    ? Math.min(...atRiskQuaters.map(q => q.daysToDecadence))
    : 0;

  // Risk badge helper
  const getRiskBadge = (riskLevel: string, daysToDecadence: number) => {
    switch (riskLevel) {
      case 'critical':
        return { label: `🔴 DECADUTO`, class: 'bg-red-100 text-red-800' };
      case 'warning':
        return { label: `🟠 ${daysToDecadence}gg`, class: 'bg-orange-100 text-orange-800' };
      case 'caution':
        return { label: `🟡 ${daysToDecadence}gg`, class: 'bg-yellow-100 text-yellow-800' };
      default:
        return { label: `🟢 ${daysToDecadence}gg`, class: 'bg-green-100 text-green-800' };
    }
  };

  // ALWAYS render PrintLayout so session bridge is active
  return (
    <PrintLayout
      title="Quater a Rischio Decadenza"
      subtitle={`Report generato il ${new Date().toLocaleDateString('it-IT')} - Tolleranza: ${QUATER_TOLERANCE_DAYS} giorni`}
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
                <div className="print-kpi-label">Totale Quater</div>
                <div className="print-kpi-value">{atRiskQuaters.length}</div>
              </div>
              <div className="print-kpi">
                <div className="print-kpi-label">Importo Totale</div>
                <div className="print-kpi-value">{formatCurrency(totalAmount)}</div>
              </div>
              <div className="print-kpi">
                <div className="print-kpi-label text-red-600">Decadute</div>
                <div className="print-kpi-value text-red-600">{critical.length}</div>
              </div>
              <div className="print-kpi">
                <div className="print-kpi-label text-orange-600">Urgenti (1-5gg)</div>
                <div className="print-kpi-value text-orange-600">{warning.length}</div>
              </div>
              <div className="print-kpi">
                <div className="print-kpi-label text-yellow-600">Attenzione</div>
                <div className="print-kpi-value text-yellow-600">{caution.length + ok.length}</div>
              </div>
            </div>
          </section>

          {/* Tabella Quater */}
          {atRiskQuaters.length > 0 ? (
            <section className="mb-8 avoid-break">
              <h2 className="text-lg font-semibold mb-3 border-b pb-2">
                Dettaglio Rateazioni Quater ({atRiskQuaters.length})
              </h2>

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
                    <th className="text-center">Rischio</th>
                  </tr>
                </thead>
                <tbody>
                  {atRiskQuaters.map((q) => {
                    const risk = getRiskBadge(q.riskLevel, q.daysToDecadence);
                    return (
                      <tr key={q.rateationId}>
                        <td className="font-mono text-sm">{q.numero}</td>
                        <td className="text-sm">{q.tipoQuater}</td>
                        <td>{q.contribuente || 'N/A'}</td>
                        <td className="text-right font-semibold">{formatCurrency(q.importoRata)}</td>
                        <td>{formatDate(q.dueDateRata)}</td>
                        <td className="font-semibold">{formatDate(q.decadenceDate)}</td>
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
              </table>
            </section>
          ) : (
            <div className="text-center py-12">
              <p className="text-lg text-muted-foreground">Nessuna rateazione Quater a rischio</p>
              <p className="text-sm text-muted-foreground mt-2">
                Tutte le rateazioni Quater sono in regola con i pagamenti
              </p>
            </div>
          )}

          {/* Legend */}
          <section className="mt-8 border-t pt-4">
            <h3 className="text-sm font-semibold mb-2">Legenda</h3>
            <div className="text-xs text-muted-foreground space-y-1">
              <p><strong>Data Decadenza</strong> = Scadenza Rata + {QUATER_TOLERANCE_DAYS} giorni di tolleranza</p>
              <p><strong>Finestra visibilità</strong>: Vengono mostrate le rateazioni con decadenza entro {QUATER_VISIBILITY_WINDOW} giorni</p>
              <div className="mt-2 space-y-1">
                <p>• <span className="inline-block w-16 text-center bg-red-100 text-red-800 rounded px-1">DECADUTO</span> Tolleranza esaurita (0 o meno giorni)</p>
                <p>• <span className="inline-block w-16 text-center bg-orange-100 text-orange-800 rounded px-1">1-5gg</span> Urgente, dentro tolleranza</p>
                <p>• <span className="inline-block w-16 text-center bg-yellow-100 text-yellow-800 rounded px-1">6-10gg</span> Attenzione</p>
                <p>• <span className="inline-block w-16 text-center bg-green-100 text-green-800 rounded px-1">11-20gg</span> Monitoraggio</p>
              </div>
            </div>
          </section>
        </>
      )}
    </PrintLayout>
  );
}
