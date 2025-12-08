import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { F24AtRiskItem } from "@/features/rateations/hooks/useF24AtRisk";

interface F24AtRiskAlertProps {
  atRiskF24s: F24AtRiskItem[];
  onNavigate: () => void;
}

/**
 * Dashboard alert banner for F24 rateations at risk
 * Mostra alert a 3 livelli: CRITICAL (rosso), WARNING (giallo), INFO (blu)
 */
export function F24AtRiskAlert({ atRiskF24s, onNavigate }: F24AtRiskAlertProps) {
  // Separa per livello di rischio
  const critical = atRiskF24s.filter(f => f.riskLevel === 'critical');
  const warning = atRiskF24s.filter(f => f.riskLevel === 'warning');
  const info = atRiskF24s.filter(f => f.riskLevel === 'info');
  
  // Debug logging
  console.log('🔵 [F24AtRiskAlert] Data:', {
    total: atRiskF24s.length,
    critical: critical.length,
    warning: warning.length,
    info: info.length,
    infoItems: info.map(f => ({ numero: f.numero, overdueCount: f.overdueCount, daysRemaining: f.daysRemaining }))
  });
  
  // Nessun alert se tutto OK
  if (critical.length === 0 && warning.length === 0 && info.length === 0) {
    return (
      <Alert className="border-green-500 bg-green-50">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <AlertTitle className="text-green-900">
          Tutte le rateazioni F24 sono in regola
        </AlertTitle>
        <AlertDescription className="text-green-800">
          Nessuna rata scaduta o in scadenza ravvicinata rilevata.
        </AlertDescription>
      </Alert>
    );
  }
  
  return (
    <div className="space-y-3">
      {/* 📊 Riepilogo Contatore */}
      <div className="text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2 flex items-center gap-2">
        <span className="font-medium">📊 Riepilogo F24:</span>
        <span className={critical.length > 0 ? "text-red-600 font-semibold" : "text-muted-foreground"}>
          {critical.length} urgenti
        </span>
        <span className="text-muted-foreground">|</span>
        <span className={info.length > 0 ? "text-blue-600 font-semibold" : "text-muted-foreground"}>
          {info.length} promemoria
        </span>
        <span className="text-muted-foreground">|</span>
        <span className={warning.length > 0 ? "text-yellow-600 font-semibold" : "text-muted-foreground"}>
          {warning.length} in attenzione
        </span>
      </div>

      {/* 🔴 Alert Rosso: Rischio decadenza immediato */}
      {critical.length > 0 && (
        <Alert className="border-red-500 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertTitle className="text-red-900 font-semibold">
            {critical.length} F24 a rischio decadenza immediato
          </AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span className="text-red-800">
              Rate scadute da pagare entro 20 giorni per evitare la decadenza. 
              <strong className="block mt-1">Azione richiesta URGENTE.</strong>
            </span>
            <Button 
              onClick={onNavigate} 
              variant="outline"
              size="sm"
              className="ml-4 border-red-600 text-red-600 hover:bg-red-100"
            >
              Vedi urgenti →
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* 🔵 Promemoria Blu: Rate scadute ma senza rischio imminente - PRIMA di warning */}
      {info.length > 0 && (
        <Alert className="border-blue-400 bg-blue-50">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertTitle className="text-blue-900">
            ℹ️ Promemoria: {info.length} F24 con {info.length === 1 ? 'rata scaduta' : 'rate scadute'} da pagare
          </AlertTitle>
          <AlertDescription className="text-blue-800">
            <ul className="mt-2 space-y-2">
              {info.map(f => (
                <li key={f.rateationId} className="border-l-2 border-blue-300 pl-3">
                  <strong className="text-blue-900">{f.numero}</strong>
                  <div className="text-sm mt-1 space-y-0.5">
                    <div>✓ <strong>{f.overdueCount}</strong> {f.overdueCount === 1 ? 'rata scaduta' : 'rate scadute'} da <strong>{f.daysOverdue}</strong> giorni</div>
                    <div>✓ Prossima scadenza tra <strong>{f.daysRemaining}</strong> giorni</div>
                    <div className="text-blue-600 text-xs">✓ Non a rischio decadenza - tempo disponibile per saldare</div>
                  </div>
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
      
      {/* 🟡 Alert Giallo: Attenzione preventiva - DOPO info */}
      {warning.length > 0 && (
        <Alert className="border-yellow-500 bg-yellow-50">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertTitle className="text-yellow-900">
            {warning.length} F24 con scadenze ravvicinate (30 giorni)
          </AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span className="text-yellow-800">
              Rate in scadenza entro 30 giorni. Nessuna rata scaduta al momento.
              <strong className="block mt-1">Pianificare i pagamenti.</strong>
            </span>
            <Button 
              onClick={onNavigate} 
              variant="outline"
              size="sm"
              className="ml-4 border-yellow-600 text-yellow-600 hover:bg-yellow-100"
            >
              Monitora →
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
