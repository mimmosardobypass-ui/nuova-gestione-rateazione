import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, Skull, CheckCircle } from "lucide-react";
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
  if (status === 'ATTIVA' && !isF24) {
    return null;
  }

  // F24 Active badge
  if (status === 'ATTIVA' && isF24) {
    return (
      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
        <Clock className="h-3 w-3 mr-1" />
        F24
      </Badge>
    );
  }

  // Warning status for interrupted plans
  if (status === 'INTERROTTA') {
    return (
      <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 animate-pulse">
        <AlertTriangle className="h-3 w-3 mr-1" />
        Interrotta
      </Badge>
    );
  }

  // Decadence status
  if (status === 'DECADUTA') {
    return (
      <Badge variant="destructive" className="animate-pulse">
        <Skull className="h-3 w-3 mr-1" />
        Decaduta
      </Badge>
    );
  }

  // Extinct status
  if (status === 'ESTINTA') {
    return (
      <Badge variant="destructive">
        <Skull className="h-3 w-3 mr-1" />
        Estinta
      </Badge>
    );
  }

  // Completed status
  if (status === 'COMPLETATA') {
    return (
      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
        <CheckCircle className="h-3 w-3 mr-1" />
        Completata
      </Badge>
    );
  }

  return null;
}