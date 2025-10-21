import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Calendar, Clock } from "lucide-react";

interface F24RecoveryAlertProps {
  overdueCount: number;
  unpaidCount: number;
  nextDueDate: string;
  daysRemaining: number;
  onViewUnpaidInstallments: () => void;
}

/**
 * Expanded alert for F24 recovery window in detail panel
 */
export function F24RecoveryAlert({ 
  overdueCount,
  unpaidCount, 
  nextDueDate, 
  daysRemaining,
  onViewUnpaidInstallments 
}: F24RecoveryAlertProps) {
  // Format date for display
  const formattedDate = new Date(nextDueDate).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  // Determine alert variant based on urgency
  const isUrgent = daysRemaining < 10;

  return (
    <Alert className={`${isUrgent ? 'border-red-500 bg-red-50' : 'border-orange-500 bg-orange-50'}`}>
      <AlertTriangle className={`h-4 w-4 ${isUrgent ? 'text-red-600' : 'text-orange-600'}`} />
      <AlertTitle className={isUrgent ? 'text-red-900' : 'text-orange-900'}>
        ⚠️ ATTENZIONE: Recovery Window Attivo
      </AlertTitle>
      <AlertDescription className="space-y-3">
        <p className={isUrgent ? 'text-red-800' : 'text-orange-800'}>
          Hai <strong>{overdueCount}</strong> {overdueCount === 1 ? 'rata scaduta' : 'rate scadute'} che {overdueCount === 1 ? 'deve' : 'devono'} essere {overdueCount === 1 ? 'saldata' : 'saldate'} entro la prossima scadenza per evitare la decadenza.
          {unpaidCount > 0 && (
            <span className="text-xs ml-1">
              ({unpaidCount} {unpaidCount === 1 ? 'rata futura' : 'rate future'} non {unpaidCount === 1 ? 'pagata' : 'pagate'} in totale)
            </span>
          )}
        </p>
        
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span>Prossima scadenza: <strong>{formattedDate}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span>Tempo rimanente: <strong>{daysRemaining} {daysRemaining === 1 ? 'giorno' : 'giorni'}</strong></span>
          </div>
        </div>

        <div className="pt-2">
          <Button 
            size="sm" 
            variant={isUrgent ? "destructive" : "default"}
            onClick={onViewUnpaidInstallments}
          >
            Vedi rate scadute ↓
          </Button>
        </div>

        <p className="text-xs text-muted-foreground pt-2">
          💡 <strong>Suggerimento:</strong> Se paghi in ritardo ma entro la prossima scadenza, puoi utilizzare il ravvedimento operoso per regolarizzare il pagamento.
        </p>
      </AlertDescription>
    </Alert>
  );
}
