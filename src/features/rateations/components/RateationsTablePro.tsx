import React, { useState, useCallback, useEffect } from "react";
import { formatEuro } from "@/lib/formatters";
import { MAX_PAGOPA_SKIPS } from '@/features/rateations/constants/pagopa';
import { getSkipRisk } from '@/features/rateations/lib/pagopaSkips';
import { RateationRowDetailsPro } from "./RateationRowDetailsPro";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Eye, Pencil, Trash2 } from "lucide-react";
import { EditRateationModal } from "./EditRateationModal";

export type RateationRowPro = {
  id: string;
  numero: string;
  tipo: string;
  contribuente: string | null;
  importoTotale: number;
  importoPagato: number;
  importoRitardo: number;
  residuo: number;
  rateTotali: number;
  ratePagate: number;
  rateNonPagate: number;
  rateInRitardo: number;
  ratePaidLate: number;
  // PagoPA specific fields
  unpaid_overdue_today?: number;
  skip_remaining?: number;
  at_risk_decadence?: boolean;
};

interface RateationsTableProProps {
  rows: RateationRowPro[];
  loading?: boolean;
  error?: string | null;
  online?: boolean;
  onDelete?: (id: string) => void;
  onRefresh?: () => void;
  onDataChanged?: () => void;
  deleting?: string | null;
}

export function RateationsTablePro({ 
  rows, 
  loading, 
  error, 
  online, 
  onDelete, 
  onRefresh, 
  onDataChanged, 
  deleting 
}: RateationsTableProProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);

  const toggle = (id: string) => setOpenId((cur) => (cur === id ? null : id));

  if (loading) {
    return <div className="p-6 text-center text-muted-foreground">Caricamento...</div>;
  }

  if (error) {
    return <div className="p-6 text-center text-destructive">Errore: {error}</div>;
  }

  if (!online) {
    return <div className="p-6 text-center text-orange-600">Modalità offline</div>;
  }

  if (!rows.length) {
    return <div className="p-6 text-center text-muted-foreground">Nessuna rateazione trovata</div>;
  }

  return (
    <>
      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>Numero</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Contribuente</TableHead>
              <TableHead className="text-right">Importo totale</TableHead>
              <TableHead className="text-right">Importo pagato</TableHead>
              <TableHead className="text-right">Importo in ritardo</TableHead>
              <TableHead className="text-right">Totale residuo</TableHead>
              <TableHead className="text-center">Rate totali</TableHead>
              <TableHead className="text-center">Rate pagate</TableHead>
              <TableHead className="text-center">Rate non pagate</TableHead>
              <TableHead className="text-center">Rate in ritardo / Non pagate oggi</TableHead>
              <TableHead>Azioni</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {rows.map((r) => {
              const opened = openId === r.id;
              return (
                <React.Fragment key={r.id}>
                  <TableRow>
                    <TableCell>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => toggle(r.id)}
                        className="p-1 h-6 w-6"
                        aria-expanded={opened}
                        aria-controls={`row-details-${r.id}`}
                      >
                        {opened ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </Button>
                    </TableCell>
                    <TableCell className="font-medium">{r.numero || "—"}</TableCell>
                    <TableCell>{r.tipo}</TableCell>
                    <TableCell>{r.contribuente || "—"}</TableCell>
                    <TableCell className="text-right font-medium">{formatEuro(r.importoTotale)}</TableCell>
                    <TableCell className="text-right">{formatEuro(r.importoPagato)}</TableCell>
                    <TableCell className={`text-right ${r.importoRitardo > 0 ? "text-destructive font-medium" : ""}`}>
                      {formatEuro(r.importoRitardo)}
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatEuro(r.residuo)}</TableCell>
                    <TableCell className="text-center">{r.rateTotali}</TableCell>
                    <TableCell className="text-center text-green-600">{r.ratePagate}</TableCell>
                    <TableCell className="text-center">{r.rateNonPagate}</TableCell>
                     <TableCell className={`text-center ${
                       r.tipo.toUpperCase() === 'PAGOPA' 
                         ? (r.unpaid_overdue_today && r.unpaid_overdue_today > 0 ? "text-destructive font-medium" : "")
                         : ((r.rateInRitardo + (r.ratePaidLate || 0)) > 0 ? "text-destructive font-medium" : "")
                      }`}>
                         {r.tipo.toUpperCase() === 'PAGOPA' ? (
                           <div className="flex items-center gap-3">
                             <span className="inline-flex items-center gap-1">
                               <span className="text-sm text-muted-foreground">Non pagate oggi:</span>
                               <span className="font-medium">{r.unpaid_overdue_today ?? 0}</span>
                             </span>

                             {typeof r.skip_remaining !== 'undefined' && (
                               <span className="inline-flex items-center gap-1">
                                 <span className="text-sm text-muted-foreground">Salti:</span>
                                 <span className="font-medium">{r.skip_remaining ?? MAX_PAGOPA_SKIPS}/{MAX_PAGOPA_SKIPS}</span>
                                 {(() => {
                                   const risk = getSkipRisk(r.skip_remaining);
                                   return risk ? (
                                     <span className={`ml-1 ${risk.cls}`} title={risk.title} aria-label={risk.title}>⚠️</span>
                                   ) : null;
                                 })()}
                               </span>
                             )}
                           </div>
                         ) : (
                           r.rateInRitardo + (r.ratePaidLate || 0)
                         )}
                     </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => toggle(r.id)}
                          className="p-1 h-8 w-8"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => setEditId(r.id)}
                          className="p-1 h-8 w-8"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => onDelete?.(r.id)}
                          disabled={deleting === r.id}
                          className="p-1 h-8 w-8 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>

                  {/* Riga di dettaglio espandibile */}
                  {opened && (
                    <TableRow>
                      <TableCell colSpan={13} className="p-0">
                        <div 
                          id={`row-details-${r.id}`}
                          role="region"
                          aria-label="Dettaglio rateazione"
                          className="mx-2 my-2 rounded-lg border bg-muted/20 overflow-hidden"
                        >
                          <RateationRowDetailsPro 
                            rateationId={r.id} 
                            onDataChanged={onDataChanged}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {editId && (
        <EditRateationModal
          open={true}
          rateationId={editId}
          onOpenChange={(open) => {
            if (!open) setEditId(null);
          }}
          onSaved={() => {
            onRefresh?.();
            onDataChanged?.();
            setEditId(null);
          }}
        />
      )}
    </>
  );
}