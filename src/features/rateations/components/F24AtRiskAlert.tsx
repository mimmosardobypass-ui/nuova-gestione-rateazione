import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface F24AtRiskAlertProps {
  atRiskCount: number;
  onNavigate: () => void;
}

/**
 * Dashboard alert banner for F24 rateations at risk
 */
export function F24AtRiskAlert({ atRiskCount, onNavigate }: F24AtRiskAlertProps) {
  if (atRiskCount === 0) return null;

  return (
    <Alert className="border-orange-500 bg-orange-50">
      <AlertTriangle className="h-4 w-4 text-orange-600" />
      <AlertTitle className="text-orange-900">
        {atRiskCount} {atRiskCount === 1 ? 'Rateazione F24 a rischio decadenza' : 'Rateazioni F24 a rischio decadenza'}
      </AlertTitle>
      <AlertDescription className="flex items-center justify-between">
        <span className="text-orange-800">
          {atRiskCount === 1 
            ? 'C\'è un piano F24 con scadenze imminenti (≤ 20 giorni)'
            : `Ci sono ${atRiskCount} piani F24 con scadenze imminenti (≤ 20 giorni)`
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
