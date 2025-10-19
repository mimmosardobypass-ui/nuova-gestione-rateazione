import React from "react";
import { Badge } from "@/components/ui/badge";
import { TrendingUp } from "lucide-react";
import { formatEuro } from "@/lib/formatters";

interface ExtraCostBadgeProps {
  maggiorazioneCents: number;
  className?: string;
  showIcon?: boolean;
}

/**
 * Badge per visualizzare la maggiorazione (extra costo) 
 * di un F24 decaduto migrato a PagoPA
 */
export function ExtraCostBadge({ 
  maggiorazioneCents, 
  className = "",
  showIcon = true 
}: ExtraCostBadgeProps) {
  if (maggiorazioneCents <= 0) {
    return null;
  }

  const euroAmount = maggiorazioneCents / 100;

  return (
    <Badge 
      variant="destructive" 
      className={`gap-1 ${className}`}
      title="Costo aggiuntivo rispetto al residuo F24 originale"
    >
      {showIcon && <TrendingUp className="w-3 h-3" />}
      <span className="font-mono">+{formatEuro(euroAmount)}</span>
    </Badge>
  );
}

/**
 * Componente dettagliato per mostrare breakdown costi F24→PagoPA
 */
export function ExtraCostBreakdown({
  residuoF24Cents,
  totalePagopaCents,
  maggiorazioneCents
}: {
  residuoF24Cents: number;
  totalePagopaCents: number;
  maggiorazioneCents: number;
}) {
  const formatCents = (cents: number) => formatEuro(cents / 100);

  return (
    <div className="space-y-2 text-sm">
      <div className="flex justify-between">
        <span className="text-muted-foreground">Residuo F24 originale:</span>
        <span className="font-mono">{formatCents(residuoF24Cents)}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Totale PagoPA:</span>
        <span className="font-mono">{formatCents(totalePagopaCents)}</span>
      </div>
      <div className="border-t pt-2 flex justify-between font-medium">
        <span className="text-destructive">Extra costo (maggiorazione):</span>
        <span className="font-mono text-destructive">
          +{formatCents(maggiorazioneCents)}
        </span>
      </div>
    </div>
  );
}
