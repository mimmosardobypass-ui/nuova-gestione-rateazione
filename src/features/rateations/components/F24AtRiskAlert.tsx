import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

interface F24AtRiskAlertProps {
  atRiskCount: number;
  onNavigate: () => void;
}

/**
 * Dashboard alert banner for F24 rateations at risk
 * Shows green "all clear" message when no F24s are at risk
 */
export function F24AtRiskAlert({ atRiskCount, onNavigate }: F24AtRiskAlertProps) {
  // Case: F24s at risk → Orange alert
  if (atRiskCount > 0) {
    return (
      <Alert className="border-orange-500 bg-orange-50">
        <AlertTriangle className="h-4 w-4 text-orange-600" />
        <AlertTitle className="text-orange-900">
          {atRiskCount} {atRiskCount === 1 ? 'Rateazione F24 a rischio decadenza' : 'Rateazioni F24 a rischio decadenza'}
        </AlertTitle>
        <AlertDescription className="flex items-center justify-between">
          <span className="text-orange-800">
            {atRiskCount === 1 
              ? 'C\'è un piano F24 con rate scadute che devono essere pagate entro 20 giorni (prima della prossima scadenza)'
              : `Ci sono ${atRiskCount} piani F24 con rate scadute che devono essere pagate entro 20 giorni (prima della prossima scadenza)`
            }
          </span>
          <Button 
            onClick={onNavigate} 
            variant="outline"
            size="sm"
            className="ml-4 border-orange-600 text-orange-600 hover:bg-orange-100"
          >
            Vedi rateazioni a rischio →
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // Case: No F24s at risk → Green success alert
  return (
    <Alert className="border-green-500 bg-green-50">
      <CheckCircle2 className="h-4 w-4 text-green-600" />
      <AlertTitle className="text-green-900">
        Nessuna rateazione F24 a rischio decadenza
      </AlertTitle>
      <AlertDescription className="text-green-800">
        Tutte le rateazioni F24 sono in regola o hanno tempo sufficiente per il pagamento delle rate scadute.
      </AlertDescription>
    </Alert>
  );
}
