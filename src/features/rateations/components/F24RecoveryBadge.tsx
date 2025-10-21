import { Badge } from "@/components/ui/badge";
import { getRecoveryBadgeClasses } from "../utils/f24RecoveryWindow";
import { Calendar, Clock } from "lucide-react";

interface F24RecoveryBadgeProps {
  unpaidCount: number;
  nextDueDate: string; // ISO format
  daysRemaining: number;
}

/**
 * Compact badge for F24 recovery window display in table
 */
export function F24RecoveryBadge({ unpaidCount, nextDueDate, daysRemaining }: F24RecoveryBadgeProps) {
  const classes = getRecoveryBadgeClasses(daysRemaining);
  
  // Format date for display (DD/MM/YYYY)
  const formattedDate = new Date(nextDueDate).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  return (
    <div className={`inline-flex flex-col gap-1 p-2 rounded-md border ${classes}`}>
      <div className="flex items-center gap-1 text-xs font-medium">
        <span className="text-base">🚨</span>
        <span>{unpaidCount} {unpaidCount === 1 ? 'rata non pagata' : 'rate non pagate'}</span>
      </div>
      <div className="flex items-center gap-1 text-xs">
        <Clock className="h-3 w-3" />
        <span className="font-medium">{daysRemaining} {daysRemaining === 1 ? 'giorno' : 'giorni'} rimanenti</span>
      </div>
      <div className="flex items-center gap-1 text-xs">
        <Calendar className="h-3 w-3" />
        <span>Entro: <span className="font-medium">{formattedDate}</span></span>
      </div>
    </div>
  );
}
