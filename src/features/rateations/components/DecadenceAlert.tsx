import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Clock, Eye } from "lucide-react";
import { InstallmentUI, RateationStatus } from "../types";
import { isInstallmentPaid, getDaysOverdue } from "../lib/installmentState";

interface DecadenceAlertProps {
  rateationId: number;
  isF24: boolean;
  status: RateationStatus;
  installments: InstallmentUI[];
  onConfirmDecadence: (installmentId: number, reason?: string) => void;
  onViewOverdueInstallments: () => void;
  // PagoPA specific props
  tipo?: string;
  at_risk_decadence?: boolean;
  unpaid_overdue_today?: number;
  max_skips_effective?: number;
}

export function DecadenceAlert({
  rateationId,
  isF24,
  status,
  installments,
  onConfirmDecadence,
  onViewOverdueInstallments,
  tipo,
  at_risk_decadence,
  unpaid_overdue_today,
  max_skips_effective
}: DecadenceAlertProps) {
  // Don't show for already decayed plans
  if (status === 'decaduta') {
    return null;
  }

  // Tolerant condition: check both tipo string and potential DB flags
  const isPagoPA = tipo?.toUpperCase() === 'PAGOPA' || (tipo ?? '').toUpperCase().includes('PAGOPA');

  // PagoPA decadence logic: show banner when at_risk_decadence is true
  if (isPagoPA && at_risk_decadence) {
    const handleConfirmPagoPA = () => {
      const reason = `Decadenza confermata per PagoPA - limite salti raggiunto (${unpaid_overdue_today}/${max_skips_effective})`;
      // For PagoPA, we don't have a specific installment, use first overdue one
      const firstOverdueInstallment = installments.find(inst => 
        !isInstallmentPaid(inst) && getDaysOverdue(inst) > 0
      );
      if (firstOverdueInstallment) {
        onConfirmDecadence(firstOverdueInstallment.id, reason);
      }
    };

    return (
      <Alert className="border-destructive/50 bg-destructive/5">
        <AlertTriangle className="h-4 w-4 text-destructive" />
        <AlertTitle className="text-destructive">
          Pre-decadenza PagoPA rilevata
        </AlertTitle>
        <AlertDescription className="space-y-3">
          <p>
            Rilevate rate non pagate ≥ {max_skips_effective || 8} (attualmente {unpaid_overdue_today}). 
            Il limite di salti consentiti per PagoPA è stato raggiunto. 
            Confermi la decadenza del piano?
          </p>
          
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="destructive" 
              size="sm"
              onClick={handleConfirmPagoPA}
            >
              <AlertTriangle className="h-3 w-3 mr-1" />
              Conferma decadenza
            </Button>
            
            <Button 
              variant="outline" 
              size="sm"
              onClick={onViewOverdueInstallments}
            >
              <Eye className="h-3 w-3 mr-1" />
              Vedi rate in ritardo
            </Button>
            
            <Button 
              variant="ghost" 
              size="sm"
              className="text-muted-foreground"
            >
              <Clock className="h-3 w-3 mr-1" />
              Rimanda
            </Button>
            
            {/* Migration button for PagoPA - to handle riammissione */}
            {/* Note: This would need the full rateation object with migration fields */}
            {/* For now, we comment this out since we only have basic props */}
            {/* 
            <MigrationDialog
              rateation={rateationObject}
              trigger={
                <Button variant="secondary" size="sm">
                  <Package className="h-3 w-3 mr-1" />
                  Gestisci riammissione
                </Button>
              }
              onMigrationComplete={() => {
                // Could trigger refresh or confirm decadence
              }}
            />
            */}
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  // F24 decadence logic (existing)
  if (!isF24) {
    return null;
  }

  // Find overdue installments (more than 90 days past due)
  const overdueInstallments = installments.filter(inst => {
    if (isInstallmentPaid(inst)) return false;
    return getDaysOverdue(inst) > 90;
  });

  // Don't show alert if no overdue installments
  if (overdueInstallments.length === 0) {
    return null;
  }

  const firstOverdueInstallment = overdueInstallments[0];
  const daysPastDue = getDaysOverdue(firstOverdueInstallment);

  const handleConfirmF24 = () => {
    const reason = `Decadenza confermata per rata scaduta da ${daysPastDue} giorni`;
    onConfirmDecadence(firstOverdueInstallment.id, reason);
  };

  return (
    <Alert className="border-destructive/50 bg-destructive/5">
      <AlertTriangle className="h-4 w-4 text-destructive" />
      <AlertTitle className="text-destructive">
        Pre-decadenza F24 rilevata
      </AlertTitle>
      <AlertDescription className="space-y-3">
        <p>
          Rilevata rata non pagata oltre 3 mesi (scaduta da {daysPastDue} giorni). 
          Confermi la decadenza del piano F24? L'importo residuo verrà escluso dalle 
          statistiche e spostato in Saldo Decaduto.
        </p>
        
        <div className="flex flex-wrap gap-2">
          <Button 
            variant="destructive" 
            size="sm"
            onClick={handleConfirmF24}
          >
            <AlertTriangle className="h-3 w-3 mr-1" />
            Conferma decadenza
          </Button>
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={onViewOverdueInstallments}
          >
            <Eye className="h-3 w-3 mr-1" />
            Vedi rate in ritardo
          </Button>
          
          <Button 
            variant="ghost" 
            size="sm"
            className="text-muted-foreground"
          >
            <Clock className="h-3 w-3 mr-1" />
            Rimanda
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}