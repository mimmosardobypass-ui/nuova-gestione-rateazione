import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Clock, Eye } from "lucide-react";
import { InstallmentUI, RateationStatus } from "../types";

interface DecadenceAlertProps {
  rateationId: string;
  isF24: boolean;
  status: RateationStatus;
  installments: InstallmentUI[];
  onConfirmDecadence: (installmentId: number, reason?: string) => void;
  onViewOverdueInstallments: () => void;
}

export function DecadenceAlert({
  rateationId,
  isF24,
  status,
  installments,
  onConfirmDecadence,
  onViewOverdueInstallments
}: DecadenceAlertProps) {
  // Only show for F24 plans that are not already decayed
  if (!isF24 || status === 'decaduta') {
    return null;
  }

  // Find overdue installments (more than 90 days past due)
  const today = new Date();
  const overdueInstallments = installments.filter(inst => {
    const isPaid = !!inst.paid_at || !!inst.paid_date || !!inst.is_paid;
    if (isPaid) return false;
    const dueDate = new Date(inst.due_date);
    const daysPastDue = Math.floor((today.getTime() - dueDate.getTime()) / 86400000);
    return daysPastDue > 90;
  });

  // Don't show alert if no overdue installments
  if (overdueInstallments.length === 0) {
    return null;
  }

  const firstOverdueInstallment = overdueInstallments[0];
  const dueDate = new Date(firstOverdueInstallment.due_date);
  const daysPastDue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

  const handleConfirm = () => {
    const reason = `Decadenza confermata per rata scaduta da ${daysPastDue} giorni`;
    onConfirmDecadence(firstOverdueInstallment.id, reason);
  };

  return (
    <Alert className="border-destructive/50 bg-destructive/5">
      <AlertTriangle className="h-4 w-4 text-destructive" />
      <AlertTitle className="text-destructive">
        Pre-decadenza rilevata
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
            onClick={handleConfirm}
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