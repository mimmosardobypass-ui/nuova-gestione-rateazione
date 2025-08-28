import React, { useState, useCallback, useEffect } from "react";
import { formatEuro } from "@/lib/formatters";
import { getLegacySkipRisk } from '@/features/rateations/utils/pagopaSkips';
import { RateationRowDetailsPro } from "./RateationRowDetailsPro";
import { MigrationStatusBadge } from "./MigrationStatusBadge";
import { MigrationDialog } from "./MigrationDialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Eye, Pencil, Trash2, Package, RotateCcw } from "lucide-react";
import { EditRateationModal } from "./EditRateationModal";
import { RollbackMigrationDialog } from "./RollbackMigrationDialog";
import { useNavigate } from 'react-router-dom';

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
  const navigate = useNavigate();
  const [openId, setOpenId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);

  const toggle = (id: string) => setOpenId((cur) => (cur === id ? null : id));

  const handleViewTarget = (targetId: string) => {
    navigate(`/rateations?search=${targetId}`);
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
              <TableHead className="text-center">Rate in ritardo / Scadenti oggi</TableHead>
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
                       r.is_pagopa 
                         ? (r.unpaid_overdue_today && r.unpaid_overdue_today > 0 ? "text-destructive font-medium" : "")
                         : ((r.rateInRitardo + (r.ratePaidLate || 0)) > 0 ? "text-destructive font-medium" : "")
                      }`}>
                          {r.is_pagopa ? (
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
                        {/* Migration and rollback buttons for PagoPA rateations */}
                        {r.is_pagopa && (
                          <>
                            <MigrationDialog
                              rateation={r}
                              trigger={
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  className="p-1 h-8 w-8 text-blue-600 hover:text-blue-700"
                                  title="Gestisci migrazione cartelle"
                                >
                                  <Package className="h-4 w-4" />
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
                                    className="p-1 h-8 w-8 text-orange-600 hover:text-orange-700"
                                    title="Ripristina migrazione"
                                  >
                                    <RotateCcw className="h-4 w-4" />
                                  </Button>
                                }
                                onRollbackComplete={() => {
                                  onRefresh?.();
                                  onDataChanged?.();
                                }}
                              />
                            )}
                          </>
                        )}
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