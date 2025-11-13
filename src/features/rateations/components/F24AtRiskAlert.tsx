import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { F24AtRiskItem } from "@/features/rateations/hooks/useF24AtRisk";

interface F24AtRiskAlertProps {
  atRiskF24s: F24AtRiskItem[]; // ✅ Passa l'array completo invece del count
  onNavigate: () => void;
}

/**
 * Dashboard alert banner for F24 rateations at risk
 * Mostra alert a 2 livelli: CRITICAL (rosso) e WARNING (giallo)
 */
export function F24AtRiskAlert({ atRiskF24s, onNavigate }: F24AtRiskAlertProps) {
  // Separa per livello di rischio
  const critical = atRiskF24s.filter(f => f.riskLevel === 'critical');
  const warning = atRiskF24s.filter(f => f.riskLevel === 'warning');
  
  // Nessun alert se tutto OK
  if (critical.length === 0 && warning.length === 0) {
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
      {/* 🔴 Alert Rosso: Rischio decadenza immediato */}
      {critical.length > 0 && (
        <Alert className="border-red-500 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertTitle className="text-red-900 font-semibold">
            🚨 {critical.length} F24 a rischio decadenza immediato
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
      
      {/* 🟡 Alert Giallo: Attenzione preventiva */}
      {warning.length > 0 && (
        <Alert className="border-yellow-500 bg-yellow-50">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertTitle className="text-yellow-900">
            ⚠️ {warning.length} F24 con scadenze ravvicinate (30 giorni)
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
