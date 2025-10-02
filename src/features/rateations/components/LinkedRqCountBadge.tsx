import React from "react";
import { Badge } from "@/components/ui/badge";
import { usePagopaLinkedRqCount } from "../hooks/usePagopaLinkedRqCount";

interface LinkedRqCountBadgeProps {
  pagopaId: number;
  className?: string;
}

/**
 * Badge che mostra il conteggio delle RQ collegate attive a una PagoPA
 * 
 * Stati:
 * - Loading: "… RQ" (spinner)
 * - Error/null: "— RQ" (fallback)
 * - Success: "N RQ" (es. "0 RQ", "3 RQ")
 * 
 * Stile: badge blu con bordo (bg-blue-50 text-blue-800 border-blue-200)
 */
export function LinkedRqCountBadge({ pagopaId, className = "" }: LinkedRqCountBadgeProps) {
  const { count, loading } = usePagopaLinkedRqCount(pagopaId);

  const text = loading ? "… RQ" : count !== null ? `${count} RQ` : "— RQ";

  return (
    <Badge 
      variant="outline" 
      className={`bg-blue-50 text-blue-800 border-blue-200 text-xs ${className}`}
    >
      {text}
    </Badge>
  );
}
