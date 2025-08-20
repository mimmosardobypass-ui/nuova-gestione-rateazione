import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, Skull } from "lucide-react";
import { RateationStatus } from "../types";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface DecadenceStatusBadgeProps {
  status: RateationStatus;
  decadenceAt?: string | null;
  isF24?: boolean;
}

export function DecadenceStatusBadge({ 
  status, 
  decadenceAt, 
  isF24 = false 
}: DecadenceStatusBadgeProps) {
  // Don't show anything for regular active plans
  if (status === 'active' && !isF24) {
    return null;
  }

  // F24 Active badge
  if (status === 'active' && isF24) {
    return (
      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
        <Clock className="h-3 w-3 mr-1" />
        F24
      </Badge>
    );
  }

  // Pre-decadence pending
  if (status === 'decadence_pending') {
    return (
      <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 animate-pulse">
        <AlertTriangle className="h-3 w-3 mr-1" />
        Pre-decadenza
      </Badge>
    );
  }

  // Decayed status
  if (status === 'decaduta') {
    const decayedDate = decadenceAt ? format(new Date(decadenceAt), 'dd/MM/yyyy', { locale: it }) : '';
    
    return (
      <Badge variant="destructive">
        <Skull className="h-3 w-3 mr-1" />
        Decaduta {decayedDate && `dal ${decayedDate}`}
      </Badge>
    );
  }

  return null;
}