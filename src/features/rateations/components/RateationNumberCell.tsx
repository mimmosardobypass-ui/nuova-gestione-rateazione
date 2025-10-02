import React from "react";
import { Badge } from "@/components/ui/badge";
import { useNavigateToRateation } from "../hooks/useNavigateToRateation";

interface RateationNumberCellProps {
  row: {
    id: string;
    numero: string;
    status: 'ATTIVA' | 'INTERROTTA' | 'ESTINTA';
    is_pagopa?: boolean;
    linked_rq_count?: number;
    latest_linked_rq_number?: string | null;
    latest_rq_id?: number | null;
  };
}

/**
 * Renders the rateation number cell with interruption status and linked RQ information
 * for PagoPA rateations. This component consolidates the display logic for:
 * - Rateation number
 * - Interruption badge (for INTERROTTA status)
 * - Linked RQ information (for PagoPA with active links)
 */
export function RateationNumberCell({ row }: RateationNumberCellProps) {
  const { navigateToRateation } = useNavigateToRateation();
  const isInterrotta = row.status === 'INTERROTTA';
  const isPagopa = !!row.is_pagopa;
  const hasLinks = isPagopa && (row.linked_rq_count ?? 0) > 0;

  return (
    <div className="flex flex-col gap-1">
      {/* Numero rateazione */}
      <span className="font-medium">{row.numero || "—"}</span>

      {/* Sub-row: Badge Status + RQ Links (solo per rateazioni interrotte) */}
      {isInterrotta && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {/* Badge "Interrotta" */}
          <Badge 
            variant="outline" 
            className="bg-amber-50 text-amber-800 border-amber-200 text-xs px-1.5 py-0"
          >
            Interrotta
          </Badge>

          {/* RQ collegate (solo per PagoPA con link attivi) */}
          {hasLinks && (
            <>
              <span>•</span>
              {row.latest_linked_rq_number && row.latest_rq_id ? (
                <button
                  type="button"
                  className="text-blue-600 hover:underline font-medium"
                  onClick={() => navigateToRateation(String(row.latest_rq_id))}
                  title={`Apri ${row.latest_linked_rq_number}`}
                >
                  → collegata a {row.latest_linked_rq_number}
                </button>
              ) : (
                <span className="text-muted-foreground">
                  {row.linked_rq_count} RQ collegate
                </span>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
