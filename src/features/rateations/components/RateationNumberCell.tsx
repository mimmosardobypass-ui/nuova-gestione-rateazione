import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { useNavigateToRateation } from "../hooks/useNavigateToRateation";
import { useF24LinkedPagopa } from "../hooks/useF24LinkedPagopa";
import { FileText } from "lucide-react";
import { NoteDrawer } from "./NoteDrawer";

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
    // F24 link fields
    is_f24?: boolean;
    interruption_reason?: string | null;
    // Note fields
    notes?: string | null;
    notes_updated_at?: string | null;
    has_notes?: boolean;
    tipo?: string;
    contribuente?: string | null;
    importoTotale?: number;
  };
  onRefresh?: () => void;
}

/**
 * Renders the rateation number cell with interruption status and linked RQ information
 * for PagoPA rateations. This component consolidates the display logic for:
 * - Rateation number
 * - Interruption badge (for INTERROTTA status)
 * - Linked RQ information (for PagoPA with active links)
 * - Note icon (clickable to open NoteDrawer)
 */
export function RateationNumberCell({ row, onRefresh }: RateationNumberCellProps) {
  const { navigateToRateation } = useNavigateToRateation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  
  // Use explicit flag with fallback to status
  const isInterrotta = (row as any).is_interrupted ?? (row.status === 'INTERROTTA');
  const isDecaduta = row.status === 'DECADUTA';
  const isCompletata = row.status === 'COMPLETATA';
  const isPagopa = !!row.is_pagopa;
  const hasLinks = isPagopa && (row.linked_rq_count ?? 0) > 0;
  
  // F24 link detection
  const isF24 = !!row.is_f24;
  const isF24Linked = isF24 && row.interruption_reason === 'F24_PAGOPA_LINK';
  const { data: f24LinkData } = useF24LinkedPagopa(isF24Linked ? parseInt(row.id) : 0);
  
  // Get RQ numbers and IDs arrays from view
  const rqNumbers: string[] = (row as any).linked_rq_numbers ?? [];
  const rqIds: number[] = (row as any).linked_rq_ids ?? [];
  
  // Sort numbers numerically (extract numeric part from "2RQ", "4RQ", etc.)
  const sortedRqNumbers = rqNumbers.slice().sort((a, b) => {
    const numA = parseInt(a.replace(/\D/g, '')) || 0;
    const numB = parseInt(b.replace(/\D/g, '')) || 0;
    return numA - numB;
  });

  const hasNotes = row.has_notes || !!row.notes;

  return (
    <>
      <div className="flex flex-col gap-1">
        {/* Numero rateazione + Icona Note */}
        <div className="flex items-center gap-2">
          <span className="font-medium">{row.numero || "—"}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setDrawerOpen(true);
            }}
            className="flex items-center justify-center transition-colors hover:opacity-70"
            title={hasNotes ? "Visualizza nota" : "Aggiungi nota"}
          >
            <FileText 
              className={`h-4 w-4 ${hasNotes ? 'text-yellow-500 fill-yellow-100' : 'text-muted-foreground'}`} 
            />
          </button>
        </div>

      {/* Sub-row: Badge Status + Links */}
      {(isInterrotta || isDecaduta || isCompletata || hasLinks || isF24Linked) && (
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

            {/* Badge "Completata" */}
            {isCompletata && (
              <Badge 
                variant="outline" 
                className="bg-green-50 text-green-700 border-green-200 text-xs px-1.5 py-0"
              >
                Completata
              </Badge>
            )}

            {/* Conteggio RQ collegate (PagoPA) */}
            {hasLinks && (
              <>
                {(isInterrotta || isDecaduta) && <span>•</span>}
                <span>→ collegata a {row.linked_rq_count} RQ</span>
              </>
            )}

            {/* PagoPA collegata (F24) */}
            {isF24Linked && f24LinkData && (
              <>
                {(isInterrotta || isDecaduta) && <span>•</span>}
                <span>→ collegata a {f24LinkData.pagopa_number}</span>
              </>
            )}
          </div>

          {/* Riga 2: Chip numeri RQ (PagoPA) */}
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

          {/* Riga 2: Chip numero PagoPA (F24) */}
          {isF24Linked && f24LinkData && (
            <div className="flex flex-wrap gap-1 text-xs">
              <button
                type="button"
                className="px-1.5 py-0.5 rounded bg-green-100 border border-green-200 text-green-700 hover:bg-green-200 transition-colors"
                onClick={() => navigateToRateation(String(f24LinkData.pagopa_id))}
                title={`Apri ${f24LinkData.pagopa_number}`}
              >
                {f24LinkData.pagopa_number}
              </button>
            </div>
          )}
        </div>
      )}
      </div>

      {/* Note Drawer */}
      <NoteDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        rateation={{
          id: parseInt(row.id, 10),
          numero: row.numero,
          tipo: row.tipo || '',
          contribuente: row.contribuente || '',
          importo_totale: row.importoTotale || 0,
          notes: row.notes || null
        }}
        onRefresh={() => {
          onRefresh?.();
        }}
      />
    </>
  );
}
