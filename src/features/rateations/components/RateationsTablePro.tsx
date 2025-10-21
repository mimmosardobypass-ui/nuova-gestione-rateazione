import React, { useState, useCallback, useEffect } from "react";
import { formatEuro } from "@/lib/formatters";
import { getLegacySkipRisk } from '@/features/rateations/utils/pagopaSkips';
import { RateationRowDetailsPro } from "./RateationRowDetailsPro";
import { MigrationStatusBadge } from "./MigrationStatusBadge";
import { MigrationDialog } from "./MigrationDialog";
import { InterruptionBadge } from "./InterruptionBadge";
import { isPagoPAPlan } from "../utils/isPagopa";
import { DeleteRateationDialog } from "./DeleteRateationDialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Eye, Pencil, Package, RotateCcw } from "lucide-react";
import { EditRateationModal } from "./EditRateationModal";
import { RollbackMigrationDialog } from "./RollbackMigrationDialog";
import { useNavigateToRateation } from '../hooks/useNavigateToRateation';
import { RateationNumberCell } from "./RateationNumberCell";
import { F24RecoveryBadge } from "./F24RecoveryBadge";
import { calculateF24RecoveryWindow } from "../utils/f24RecoveryWindow";

export type RateationRowPro = {
  id: string;
  numero: string;
  tipo: string;
  contribuente: string | null;
  importoTotale: number;
  importoPagato: number;
  importoRitardo: number;
  residuo: number;
  residuoEffettivo: number;
  rateTotali: number;
  ratePagate: number;
  rateNonPagate: number;
  rateInRitardo: number;
  ratePaidLate: number;
  // PagoPA specific fields
  is_pagopa?: boolean;
  unpaid_overdue_today?: number;
  unpaid_due_today?: number;
  skip_remaining?: number;
  max_skips_effective?: number;
  at_risk_decadence?: boolean;
  // Migration fields
  debts_total?: number;
  debts_migrated?: number;
  migrated_debt_numbers?: string[];
  remaining_debt_numbers?: string[];
  rq_target_ids?: string[];         // Array of target rateation IDs (consistent string type)
  rq_migration_status?: 'none' | 'partial' | 'full';
  excluded_from_stats?: boolean;
  // PagoPA Interruption fields
  status: 'ATTIVA' | 'IN_RITARDO' | 'COMPLETATA' | 'DECADUTA' | 'INTERROTTA' | 'ESTINTA';
  interrupted_at?: string | null;
  interruption_reason?: string | null;
  interrupted_by_rateation_id?: string | null;
  // RQ link fields for interruption display
  linked_rq_count?: number;
  latest_linked_rq_number?: string | null;
  latest_rq_id?: number | null;
  // F24 link fields
  is_f24?: boolean;
};

interface RateationsTableProProps {
  rows: RateationRowPro[];
  loading?: boolean;
  error?: string | null;
  online?: boolean;
  onRefresh?: () => void;
  onDataChanged?: () => void;
}

export function RateationsTablePro({ 
  rows, 
  loading, 
  error, 
  online, 
  onRefresh, 
  onDataChanged
}: RateationsTableProProps) {
  const { navigateToRateation } = useNavigateToRateation();
  const [openId, setOpenId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);

  const toggle = (id: string) => setOpenId((cur) => (cur === id ? null : id));

  const handleViewTarget = (targetId: string) => {
    navigateToRateation(targetId);
  };

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
      <div className="rounded-xl border min-w-0 overflow-x-clip">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>Numero</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Contribuente</TableHead>
              <TableHead className="text-right whitespace-nowrap">Importo totale</TableHead>
              <TableHead className="text-right whitespace-nowrap">Importo pagato</TableHead>
              <TableHead className="text-right whitespace-nowrap">Importo in ritardo</TableHead>
              <TableHead className="text-right whitespace-nowrap">Totale residuo</TableHead>
              <TableHead className="text-center whitespace-nowrap">Rate totali</TableHead>
              <TableHead className="text-center whitespace-nowrap">Rate pagate</TableHead>
              <TableHead className="text-center whitespace-nowrap">Rate non pagate</TableHead>
              <TableHead className="text-center whitespace-nowrap">Rate in ritardo / Scadenti oggi</TableHead>
              <TableHead className="w-[120px]">Azioni</TableHead>
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
                        {opened ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <RateationNumberCell row={r} />
                    </TableCell>
                    <TableCell>{r.tipo}</TableCell>
                    <TableCell>{r.contribuente || "—"}</TableCell>
                    <TableCell className="text-right font-medium">{formatEuro(r.importoTotale)}</TableCell>
                    <TableCell className="text-right">{formatEuro(r.importoPagato)}</TableCell>
                    <TableCell className={`text-right ${r.importoRitardo > 0 ? "text-destructive font-medium" : ""}`}>
                      {formatEuro(r.importoRitardo)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatEuro(r.residuo)}
                    </TableCell>
                    <TableCell className="text-center">{r.rateTotali}</TableCell>
                    <TableCell className="text-center text-green-600">{r.ratePagate}</TableCell>
                    <TableCell className="text-center">{r.rateNonPagate}</TableCell>
                     <TableCell className={`text-center ${
                       r.is_pagopa 
                         ? (r.unpaid_overdue_today && r.unpaid_overdue_today > 0 ? "text-destructive font-medium" : "")
                         : ((r.rateInRitardo + (r.ratePaidLate || 0)) > 0 ? "text-destructive font-medium" : "")
                      }`}>
                           {(() => {
                              // F24 Recovery Window Logic
                              if (r.is_f24) {
                                // We don't have installments here, so we'll show a simplified view
                                // The full badge will be shown in the detail view
                                return <span>{r.rateInRitardo + (r.ratePaidLate || 0)}</span>;
                              }
                              
                              // Use unified helper for PagoPA detection
                              const isPagoPA = isPagoPAPlan({ is_pagopa: r.is_pagopa, tipo: r.tipo });
                             return isPagoPA ? (
                            <div className="space-y-2">
                              {/* Migration Status Badge */}
                               <MigrationStatusBadge 
                                row={r}
                                onOpenMigration={() => {
                                  // Migration dialog will be triggered via the actions column
                                }}
                                onViewTarget={handleViewTarget}
                              />
                              
                              {/* Standard PagoPA KPIs (hidden if migrated) */}
                              {r.rq_migration_status === 'none' && (
                                <div className="flex flex-col gap-1">
                                  <div className="text-sm">
                                    <span className="text-muted-foreground">In ritardo:</span>{' '}
                                    <span className="font-medium">{r.unpaid_overdue_today ?? 0}</span>
                                  </div>
                                  <div className="text-sm">
                                    <span className="text-muted-foreground">Scadenti oggi:</span>{' '}
                                    <span className="font-medium">{r.unpaid_due_today ?? 0}</span>
                                  </div>
                                   <div className="text-sm inline-flex items-center gap-2">
                                     <span className="text-muted-foreground">Salti:</span>
                                      {(() => {
                                        const max = r.max_skips_effective ?? 8;
                                        const remaining = Math.max(0, Math.min(max, r.skip_remaining ?? 8));
                                       const risk = getLegacySkipRisk(remaining);
                                      return (
                                        <>
                                          <span className="font-medium">{remaining}/{max}</span>
                                          {risk && <span className={risk.cls} title={risk.title}>⚠️</span>}
                                        </>
                                      );
                                    })()}
                                  </div>
                                </div>
                              )}
                            </div>
                           ) : (
                             // fallback piani non PagoPA: metrica esistente
                             <span>{r.rateInRitardo + (r.ratePaidLate || 0)}</span>
                           );
                           })()}
                     </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => toggle(r.id)}
                          className="p-1 h-7 w-7"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => setEditId(r.id)}
                          className="p-1 h-7 w-7"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {/* Migration and rollback buttons for PagoPA rateations */}
                        {(() => {
                          // Use unified helper for PagoPA detection  
                          const isPagoPA = isPagoPAPlan({ is_pagopa: r.is_pagopa, tipo: r.tipo });
                          return isPagoPA && (
                          <>
                            <MigrationDialog
                              rateation={r}
                              trigger={
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  className="p-1 h-7 w-7 text-blue-600 hover:text-blue-700"
                                  title="Gestisci migrazione cartelle"
                                >
                                  <Package className="h-3.5 w-3.5" />
                                </Button>
                              }
                              onMigrationComplete={() => {
                                onRefresh?.();
                                onDataChanged?.();
                              }}
                            />
                            
                            {r.rq_migration_status !== 'none' && (
                              <RollbackMigrationDialog
                                rateation={r}
                                trigger={
                                  <Button 
                                    size="sm" 
                                    variant="ghost"
                                    className="p-1 h-7 w-7 text-orange-600 hover:text-orange-700"
                                    title="Ripristina migrazione"
                                  >
                                    <RotateCcw className="h-3.5 w-3.5" />
                                  </Button>
                                }
                                onRollbackComplete={() => {
                                  onRefresh?.();
                                  onDataChanged?.();
                                }}
                              />
                            )}
                          </>
                          );
                        })()}
                        <DeleteRateationDialog 
                          id={Number(r.id)} 
                          number={r.numero} 
                          taxpayer={r.contribuente}
                        />
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
                            pagopaKpis={r.is_pagopa ? {
                              unpaid_overdue_today: r.unpaid_overdue_today ?? 0,
                              unpaid_due_today: r.unpaid_due_today,
                              max_skips_effective: r.max_skips_effective ?? 8,
                              skip_remaining: Math.max(0, Math.min(r.max_skips_effective ?? 8, r.skip_remaining ?? 8)),
                              is_pagopa: r.is_pagopa,
                              at_risk_decadence: r.at_risk_decadence
                            } : undefined}
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