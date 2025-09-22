import React, { useState, useCallback, useEffect } from "react";
import { formatEuro } from "@/lib/formatters";
import { fetchInstallments, postponeInstallment, deleteInstallment } from "../api/installments";
import { confirmDecadence } from "../api/decadence";
import { AttachmentsPanel } from "./AttachmentsPanel";
import { InstallmentPaymentActions } from "./InstallmentPaymentActions";
import { InstallmentStatusBadge } from "./InstallmentStatusBadge";
import { PrintButtons } from "@/components/print/PrintButtons";
import { DecadenceAlert } from "./DecadenceAlert";
import { DecadenceStatusBadge } from "./DecadenceStatusBadge";
import EditScheduleModal from "./EditScheduleModal";
import { isInstallmentPaid, getPaymentDate, getDaysLate } from "../lib/installmentState";
import type { InstallmentUI, RateationStatus } from "../types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

import { useToast } from "@/hooks/use-toast";
import { useOnline } from "@/hooks/use-online";
import { useDebouncedReload } from "@/hooks/useDebouncedReload";
import { supabase } from "@/integrations/supabase/client";
import { getLegacySkipRisk } from "@/features/rateations/utils/pagopaSkips";
import { toIntId } from "@/lib/utils/ids";
import { MigrationDialog } from "./MigrationDialog";
import { RollbackMigrationDialog } from "./RollbackMigrationDialog";
import { isPagoPAPlan } from "../utils/isPagopa";

// --- SAFE HELPERS ---
const DEBUG = process.env.NODE_ENV !== 'production';

const toNum = (v: any, fb = 0): number => {
  if (v === null || v === undefined) return fb;
  const n = typeof v === 'string' ? Number(v) : v;
  return Number.isFinite(n) ? n : fb;
};

const safeDate = (d?: string | null): Date | null => {
  if (!d) return null;
  const t = Date.parse(d);
  return Number.isFinite(t) ? new Date(t) : null;
};

const computeDaysLate = (due?: string | null): number => {
  const dd = safeDate(due);
  if (!dd) return 0;
  const diff = Date.now() - dd.getTime();
  return Math.max(0, Math.floor(diff / 86_400_000));
};

const formatEuroSafe = (v: any): string =>
  toNum(v).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });

interface RateationRowDetailsProProps {
  rateationId: string;
  onDataChanged?: () => void;
  // Accept pre-computed PagoPA KPIs from parent
  pagopaKpis?: {
    unpaid_overdue_today: number;
    unpaid_due_today?: number;
    max_skips_effective: number;
    skip_remaining: number;
    is_pagopa?: boolean;
    at_risk_decadence?: boolean;
  };
}

interface RateationInfo {
  is_f24: boolean;
  status: RateationStatus;
  decadence_at?: string | null;
  taxpayer_name?: string | null;
  number?: string;
  type_name?: string;
  // Migration fields
  is_pagopa?: boolean;
  rq_migration_status?: 'none' | 'partial' | 'full';
  migrated_debt_numbers?: string[];
  remaining_debt_numbers?: string[];
  rq_target_ids?: string[];
  excluded_from_stats?: boolean;
}

export function RateationRowDetailsPro({ rateationId, onDataChanged, pagopaKpis }: RateationRowDetailsProProps) {
  if (DEBUG) console.log('[DEBUG] RateationRowDetailsPro component instantiated with rateationId:', rateationId, typeof rateationId);
  
  // Race condition protection
  const ctrlRef = React.useRef<AbortController | null>(null);
  const reqIdRef = React.useRef(0);
  
  const [items, setItems] = useState<InstallmentUI[]>([]);
  const [rateationInfo, setRateationInfo] = useState<RateationInfo | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState<{ [key: string]: boolean }>({});
  const [editScheduleOpen, setEditScheduleOpen] = useState(false);
  const { toast } = useToast();
  const online = useOnline();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    // aborta eventuale richiesta precedente
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;

    const myReqId = ++reqIdRef.current;

    try {
      const rows = await fetchInstallments(rateationId, ctrl.signal);
      if (ctrl.signal.aborted || myReqId !== reqIdRef.current) return; // risposta stantia

      // Normalizzazione robusta (evita undefined/null e disallineamenti)
      const normalized = (rows ?? []).map((r: any) => ({
        ...r,
        // amount in € (se manca, prova da cents)
        amount: Number.isFinite(r?.amount)
          ? r.amount
          : toNum(r?.amount_cents, 0) / 100,
        // paid_total_cents sempre number
        paid_total_cents: toNum(r?.paid_total_cents, 0),
        // due_date coerente
        due_date: r?.due_date ?? r?.due ?? null,
        // paid_date coerente
        paid_date: r?.is_paid ? (r?.paid_date ?? r?.paid_at ?? null) : null,
        is_paid: !!r?.is_paid,
      }));

      setItems(normalized);

      // Info rateazione (come avevi già)
      const { data: rateationData } = await supabase
        .from('v_rateations_with_kpis')
        .select('*')
        .eq('id', toIntId(rateationId, 'rateationId'))
        .single();

      if (!ctrl.signal.aborted && myReqId === reqIdRef.current && rateationData) {
        setRateationInfo({
          is_f24: rateationData.is_f24 || false,
          status: (rateationData.status || 'active') as RateationStatus,
          decadence_at: null,
          taxpayer_name: rateationData.taxpayer_name,
          number: rateationData.number,
          type_name: rateationData.tipo,
          is_pagopa: !!rateationData.is_pagopa,
          rq_migration_status:
            (rateationData.rq_migration_status || 'none') as 'none' | 'partial' | 'full',
          migrated_debt_numbers: rateationData.migrated_debt_numbers || [],
          remaining_debt_numbers: rateationData.remaining_debt_numbers || [],
          rq_target_ids: (rateationData.rq_target_ids || []).map(String),
          excluded_from_stats: rateationData.excluded_from_stats || false,
        });
      }
    } catch (e: any) {
      if (!ctrl.signal.aborted) {
        setError(e?.message || 'Errore nel caricamento rate');
        setItems([]); // fallback sicuro
      }
    } finally {
      if (!ctrl.signal.aborted && reqIdRef.current === myReqId) setLoading(false);
    }
  }, [rateationId]);

  const { debouncedReload, debouncedReloadStats } = useDebouncedReload({
    loadData: load,
    reloadStats: () => onDataChanged?.()
  });

  useEffect(() => { 
    load(); 
  }, [load]);

  // Cleanup on unmount
  useEffect(() => () => ctrlRef.current?.abort(), []);

  // Use pre-computed PagoPA KPIs from parent - no recalculation
  const unpaidOverdueToday = pagopaKpis?.unpaid_overdue_today ?? 0;
  const unpaidDueToday = pagopaKpis?.unpaid_due_today ?? 0;
  const skipMax = pagopaKpis?.max_skips_effective ?? 8;
  const skipRemaining = Math.max(0, Math.min(skipMax, pagopaKpis?.skip_remaining ?? 8));
  
  // Calculate skip risk using centralized utility
  const skipRisk = React.useMemo(() => getLegacySkipRisk(skipRemaining), [skipRemaining]);

  // Decadence handlers
  const handleConfirmDecadence = useCallback(async (installmentId: number, reason?: string) => {
    if (!online) {
      toast({ variant: "destructive", title: "Errore", description: "Connessione assente" });
      return;
    }

    try {
      setProcessing(prev => ({ ...prev, 'decadence': true }));
      await confirmDecadence(toIntId(rateationId, 'rateationId'), installmentId, reason);
      
      toast({ 
        title: "Decadenza confermata", 
        description: "Il piano è stato marcato come decaduto" 
      });
      
      // Reload data
      await load();
      onDataChanged?.();
      // Trigger global KPI reload
      window.dispatchEvent(new CustomEvent('rateations:reload-kpis'));
    } catch (e: any) {
      toast({ 
        variant: "destructive", 
        title: "Errore", 
        description: e?.message || "Errore nella conferma decadenza" 
      });
    } finally {
      setProcessing(prev => ({ ...prev, 'decadence': false }));
    }
  }, [rateationId, online, toast, load, onDataChanged]);

  const handleViewOverdueInstallments = useCallback(() => {
    // Scroll to the installments table
    const table = document.querySelector('.border.rounded-lg');
    if (table) {
      table.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  const handlePostpone = async (seq: number) => {
    if (!online) {
      toast({
        title: "Offline",
        description: "Connettiti a internet per posticipare le rate",
        variant: "destructive"
      });
      return;
    }

    const newDate = prompt("Inserisci la nuova data di scadenza (YYYY-MM-DD):");
    if (!newDate) return;

    const key = `postpone-${seq}`;
    if (processing[key]) return;

    setProcessing(prev => ({ ...prev, [key]: true }));
    
    try {
      await postponeInstallment(rateationId, seq, newDate);
      await load();
      onDataChanged?.();
      toast({
        title: "Successo",
        description: "Rata posticipata con successo"
      });
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Errore nel posticipo",
        variant: "destructive"
      });
    } finally {
      setProcessing(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleDelete = async (seq: number) => {
    if (!online) {
      toast({
        title: "Offline",
        description: "Connettiti a internet per eliminare le rate",
        variant: "destructive"
      });
      return;
    }

    if (!confirm("Sei sicuro di voler eliminare questa rata?")) return;

    const key = `delete-${seq}`;
    if (processing[key]) return;

    setProcessing(prev => ({ ...prev, [key]: true }));
    
    try {
      await deleteInstallment(rateationId, seq);
      await load();
      onDataChanged?.();
      toast({
        title: "Successo",
        description: "Rata eliminata con successo"
      });
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Errore nell'eliminazione",
        variant: "destructive"
      });
    } finally {
      setProcessing(prev => ({ ...prev, [key]: false }));
    }
  };

  if (DEBUG) console.log('[DEBUG] Component render state:', { 
    itemsLength: items.length,
    loading,
    error,
    rateationInfo: !!rateationInfo,
    beforeReturnCheck: !loading && !error && items.length > 0
  });

  return (
    <div className="p-4 space-y-4">
      {/* Stati non-bloccanti */}
      {loading && <div className="p-3 text-sm text-muted-foreground">Caricamento rate…</div>}
      {!loading && error && (
        <div className="p-3 text-sm text-red-600">Errore: {String(error)}</div>
      )}
      {!loading && !error && items.length === 0 && (
        <div className="p-3 text-sm text-muted-foreground">Nessuna rata trovata.</div>
      )}

      {/* Decadence Alert */}
      {rateationInfo && (
        <DecadenceAlert
          rateationId={toIntId(rateationId, 'rateationId')}
          isF24={Boolean(rateationInfo.is_f24) || String(rateationInfo.type_name).toUpperCase() === 'F24'}
          status={rateationInfo.status}
          installments={items}
          onConfirmDecadence={handleConfirmDecadence}
          onViewOverdueInstallments={handleViewOverdueInstallments}
          tipo={rateationInfo.type_name}
          at_risk_decadence={pagopaKpis?.at_risk_decadence ?? false}
          unpaid_overdue_today={unpaidOverdueToday}
          max_skips_effective={skipMax}
        />
      )}

      {/* Header info compatto */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-4 border-b">
        {/* Meta info with status badge */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="text-sm text-muted-foreground">Rate Overview</div>
            {rateationInfo && (
              <DecadenceStatusBadge 
                status={rateationInfo.status}
                decadenceAt={rateationInfo.decadence_at}
                isF24={Boolean(rateationInfo.is_f24) || String(rateationInfo.type_name).toUpperCase() === 'F24'}
              />
            )}
          </div>
          <div className="text-sm font-medium">Totale: {items.length}</div>
        </div>
        
        {/* KPI riassunto rate */}
        <div className="grid grid-cols-2 gap-2">
          <div className="text-center p-2 bg-green-50 rounded-md">
            <div className="text-xs text-muted-foreground">Pagate</div>
            <div className="font-semibold text-green-700">
              {items.filter(it => isInstallmentPaid(it)).length}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              di cui in ritardo: <span className="font-medium">
                {items.filter(it => isInstallmentPaid(it) && getDaysLate(it) > 0).length}
              </span>
            </div>
          </div>
          <div className="text-center p-2 bg-red-50 rounded-md">
            <div className="text-xs text-muted-foreground">In ritardo</div>
            <div className="font-semibold text-red-700">
              {items.filter(it => !isInstallmentPaid(it) && getDaysLate(it) > 0).length}
            </div>
          </div>
        </div>
        
        {/* PagoPA specific KPIs */}
        {pagopaKpis && (
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border bg-card p-3">
              <div className="text-xs text-muted-foreground">In ritardo</div>
              <div className="text-lg font-semibold">{unpaidOverdueToday}</div>
            </div>

            <div className={`rounded-lg border p-3 ${skipRemaining <= 0 ? 'bg-red-50 border-red-200' : 'bg-card'}`}>
              <div className="text-xs text-muted-foreground">Salti residui</div>
              <div className="text-lg font-semibold inline-flex items-center gap-2">
                {skipRemaining}/{skipMax}
                {skipRisk && <span className={skipRisk.cls} title={skipRisk.title}>⚠️</span>}
              </div>
              {skipRemaining <= 0 && (
                <div className="mt-1 text-xs text-red-700">Rischio decadenza — limite salti raggiunto</div>
              )}
            </div>

            {/* spazio per un terzo KPI, oppure lascia vuoto */}
            <div className="rounded-lg border bg-card p-3">
              <div className="text-xs text-muted-foreground">Stato</div>
              <div className="text-sm">{rateationInfo?.status ?? '-'}</div>
            </div>
          </div>
        )}
        
        {/* Print Actions & Allegati */}
        <div className="space-y-3">
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Azioni</div>
            <div className="flex flex-col gap-2">
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => setEditScheduleOpen(true)}
                className="text-xs"
              >
                Modifica scadenze
              </Button>
              <PrintButtons 
                rateationId={rateationId}
                showDetailOptions={true}
                showSummaryOptions={false}
              />
              
              {/* Migration buttons for PagoPA plans */}
              {rateationInfo && isPagoPAPlan({ is_pagopa: rateationInfo.is_pagopa, tipo: rateationInfo.type_name }) && (
                <MigrationDialog
                  rateation={{
                    id: rateationId,
                    is_pagopa: rateationInfo.is_pagopa || false,
                    rq_migration_status: rateationInfo.rq_migration_status || 'none',
                    migrated_debt_numbers: rateationInfo.migrated_debt_numbers || [],
                    remaining_debt_numbers: rateationInfo.remaining_debt_numbers || []
                  } as any}
                  trigger={
                    <Button size="sm" variant="outline" className="text-xs gap-1">
                      Migra cartelle in RQ
                    </Button>
                  }
                  onMigrationComplete={() => {
                    load();
                    onDataChanged?.();
                  }}
                />
              )}
              
              {/* Rollback button for migrated plans */}
              {rateationInfo && 
               isPagoPAPlan({ is_pagopa: rateationInfo.is_pagopa, tipo: rateationInfo.type_name }) && 
               rateationInfo.rq_migration_status !== 'none' && (
                <RollbackMigrationDialog
                  rateation={{
                    id: rateationId,
                    is_pagopa: rateationInfo.is_pagopa || false,
                    rq_migration_status: rateationInfo.rq_migration_status || 'none',
                    migrated_debt_numbers: rateationInfo.migrated_debt_numbers || []
                  } as any}
                  trigger={
                    <Button size="sm" variant="ghost" className="text-xs text-orange-600">
                      Annulla migrazione
                    </Button>
                  }
                  onRollbackComplete={() => {
                    load();
                    onDataChanged?.();
                  }}
                />
              )}
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Allegati</div>
            <AttachmentsPanel rateationId={rateationId} />
          </div>
        </div>
      </div>

      {/* Sub-tabella rate con scroll */}
      <div className="mt-3 border rounded-lg overflow-x-auto">
        <table className="min-w-full table-auto">
          <thead>
            <tr>
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left">Scadenza</th>
              <th className="px-3 py-2 text-left">Importo</th>
              <th className="px-3 py-2 text-left">Stato</th>
              <th className="px-3 py-2 text-left">Pagata il</th>
              <th className="px-3 py-2 text-left">Pagamento</th>
              <th className="px-3 py-2 text-left">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it: any) => {
              try {
                const daysLate = computeDaysLate(it?.due_date);
                const amount = toNum(it?.amount, 0);
                const paidTot = toNum(it?.paid_total_cents, 0) / 100;
                const isPaid = !!it?.is_paid;

                return (
                  <tr key={String(it?.id ?? `${rateationId}-${it?.seq}`)}>
                    <td className="px-3 py-2">{it?.seq}</td>
                    <td className="px-3 py-2">
                      {safeDate(it?.due_date)?.toLocaleDateString('it-IT') ?? '—'}
                      {daysLate > 0 && (
                        <div className="text-xs text-orange-600">{daysLate} giorni di ritardo</div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {formatEuroSafe(amount)}
                      {isPaid && paidTot > 0 && (
                        <div className="text-xs text-muted-foreground">
                          tot. {formatEuroSafe(paidTot)} ({formatEuroSafe(paidTot - amount)} extra)
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isPaid ? 'Pagata' : daysLate > 0 ? 'In ritardo' : 'Da pagare'}
                    </td>
                    <td className="px-3 py-2">
                      {safeDate(it?.paid_date)?.toLocaleDateString('it-IT') ?? '—'}
                    </td>
                    <td className="px-3 py-2">
                      <InstallmentPaymentActions
                        rateationId={rateationId}
                        installment={it}
                        onReload={debouncedReload}
                        onStatsReload={debouncedReloadStats}
                        disabled={!online || rateationInfo?.status === 'ESTINTA'}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1 justify-end items-center">
                        {!isPaid && rateationInfo?.status !== 'ESTINTA' && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handlePostpone(it.seq)}
                            disabled={processing[`postpone-${it.seq}`]}
                            className="h-7 px-2 text-xs"
                          >
                            {processing[`postpone-${it.seq}`] ? "..." : "Posticipa"}
                          </Button>
                        )}
                        {rateationInfo?.status !== 'ESTINTA' && (
                          <Button 
                            size="sm" 
                            variant="destructive"
                            onClick={() => handleDelete(it.seq)}
                            disabled={processing[`delete-${it.seq}`]}
                            className="h-7 px-2 text-xs"
                          >
                            {processing[`delete-${it.seq}`] ? "..." : "Elimina"}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              } catch (rowErr) {
                return (
                  <tr key={`err-${String(it?.id ?? it?.seq)}`}>
                    <td colSpan={7} className="px-3 py-2 text-red-600 text-sm">
                      Errore rendering rata #{String(it?.seq)}: {String(rowErr)}
                    </td>
                  </tr>
                );
              }
            })}
          </tbody>
        </table>
      </div>

      <EditScheduleModal
        rateationId={rateationId}
        open={editScheduleOpen}
        onOpenChange={setEditScheduleOpen}
        onSaved={() => {
          load();
          onDataChanged?.();
        }}
      />
    </div>
  );
}