import React from "react";
import { Badge } from "@/components/ui/badge";
import { useF24LinkedPagopa } from "../hooks/useF24LinkedPagopa";

interface LinkedPagopaInfoBadgeProps {
  f24Id: number;
  className?: string;
}

/**
 * Badge che mostra a quale PagoPA è collegato un F24
 * 
 * Stati:
 * - Loading: "… PagoPA" (spinner)
 * - Error/null: nessun badge
 * - Success: "→ N.XX PagoPA" (es. "→ N.39 PagoPA")
 * 
 * Stile: badge verde con bordo (bg-green-50 text-green-800 border-green-200)
 */
export function LinkedPagopaInfoBadge({ f24Id, className = "" }: LinkedPagopaInfoBadgeProps) {
  const { data, loading } = useF24LinkedPagopa(f24Id);

  if (loading) {
    return (
      <Badge 
        variant="outline" 
        className={`bg-green-50 text-green-800 border-green-200 text-xs ${className}`}
      >
        … PagoPA
      </Badge>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <Badge 
      variant="outline" 
      className={`bg-green-50 text-green-800 border-green-200 text-xs ${className}`}
    >
      → {data.pagopa_number}
    </Badge>
  );
}
