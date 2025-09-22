import React from "react";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ArrowRight } from "lucide-react";
import type { RateationRow } from "../types";

interface InterruptionBadgeProps {
  rateation: RateationRow;
  onClick?: () => void;
  className?: string;
}

export function InterruptionBadge({ rateation, onClick, className }: InterruptionBadgeProps) {
  if (rateation.tipo !== 'PagoPA' || rateation.status !== 'INTERROTTA' || !rateation.interrupted_by_rateation_id) {
    return null;
  }

  const shortId = rateation.interrupted_by_rateation_id.slice(0, 8);

  return (
    <Badge 
      variant="outline" 
      className={`cursor-pointer hover:bg-muted/50 transition-colors ${className}`}
      onClick={onClick}
    >
      <AlertTriangle className="w-3 h-3 mr-1 text-orange-500" />
      Interrotta
      <ArrowRight className="w-3 h-3 mx-1" />
      <span className="text-xs font-mono">RQ #{shortId}</span>
    </Badge>
  );
}

/**
 * Badge più semplice per visualizzazioni compatte
 */
export function SimpleInterruptionBadge({ rateation }: { rateation: RateationRow }) {
  if (rateation.tipo !== 'PagoPA' || rateation.status !== 'INTERROTTA') {
    return null;
  }

  return (
    <Badge variant="outline" className="text-xs">
      <AlertTriangle className="w-3 h-3 mr-1 text-orange-500" />
      Interrotta
    </Badge>
  );
}