import React from "react";
import { Badge } from "@/components/ui/badge";
import { useNavigateToRateation } from "../hooks/useNavigateToRateation";

interface RateationNumberCellProps {
  row: {
    id: string;
    numero: string;
    status: 'ATTIVA' | 'IN_RITARDO' | 'COMPLETATA' | 'DECADUTA' | 'INTERROTTA' | 'ESTINTA';
    is_pagopa?: boolean;
    linked_rq_count?: number;
    latest_linked_rq_number?: string | null;
    latest_rq_id?: number | null;
    // New fields from v_rateations_list_ui
    is_interrupted?: boolean;
    linked_rq_numbers?: string[];
    linked_rq_ids?: number[];
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
  
  // Use explicit flag with fallback to status
  const isInterrotta = (row as any).is_interrupted ?? (row.status === 'INTERROTTA');
  const isDecaduta = row.status === 'DECADUTA';
  const isPagopa = !!row.is_pagopa;
  const hasLinks = isPagopa && (row.linked_rq_count ?? 0) > 0;
  
  // Get RQ numbers and IDs arrays from view
  const rqNumbers: string[] = (row as any).linked_rq_numbers ?? [];
  const rqIds: number[] = (row as any).linked_rq_ids ?? [];
  
  // Sort numbers numerically (extract numeric part from "2RQ", "4RQ", etc.)
  const sortedRqNumbers = rqNumbers.slice().sort((a, b) => {
    const numA = parseInt(a.replace(/\D/g, '')) || 0;
    const numB = parseInt(b.replace(/\D/g, '')) || 0;
    return numA - numB;
  });

  return (
    <div className="flex flex-col gap-1">
      {/* Numero rateazione */}
      <span className="font-medium">{row.numero || "—"}</span>

      {/* Sub-row: Badge Status + RQ Links */}
      {(isInterrotta || isDecaduta || hasLinks) && (
        <div className="flex flex-col gap-1">
          {/* Riga 1: Badge + Conteggio */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {/* Badge "Interrotta" */}
            {isInterrotta && (
              <Badge 
                variant="outline" 
                className="bg-amber-50 text-amber-800 border-amber-200 text-xs px-1.5 py-0"
              >
                Interrotta
              </Badge>
            )}

            {/* Badge "Decaduta" */}
            {isDecaduta && (
              <Badge 
                variant="destructive" 
                className="text-xs px-1.5 py-0 animate-pulse"
              >
                Decaduta
              </Badge>
            )}

            {/* Conteggio RQ collegate */}
            {hasLinks && (
              <>
                {(isInterrotta || isDecaduta) && <span>•</span>}
                <span>→ collegata a {row.linked_rq_count} RQ</span>
              </>
            )}
          </div>

          {/* Riga 2: Chip numeri RQ (se disponibili) */}
          {hasLinks && sortedRqNumbers.length > 0 && (
            <div className="flex flex-wrap gap-1 text-xs">
              {sortedRqNumbers.map((num, idx) => {
                const targetId = rqIds[rqNumbers.indexOf(num)];
                return (
                  <button
                    key={`${num}-${idx}`}
                    type="button"
                    className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 transition-colors"
                    onClick={() => {
                      if (targetId) navigateToRateation(String(targetId));
                    }}
                    title={`Apri ${num}`}
                  >
                    {num}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
