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

interface RateationRowDetailsProProps {
  rateationId: string;
  onDataChanged?: () => void;
  // Accept pre-computed PagoPA KPIs from parent
  pagopaKpis?: {
    unpaid_overdue_today: number;
    unpaid_due_today?: number;
    max_skips_effective: number;
    skip_remaining: number;
  };
}

interface RateationInfo {
  is_f24: boolean;
  status: RateationStatus;
  decadence_at?: string | null;
  taxpayer_name?: string | null;
  number?: string;
  type_name?: string;
}

export function RateationRowDetailsPro({ rateationId, onDataChanged, pagopaKpis }: RateationRowDetailsProProps) {
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
    try {
      // Load installments
      const rows = await fetchInstallments(rateationId);
      setItems(rows ?? []);

      // Load rateation info for decadence management with type information
      const { data: rateationData, error: rateationError } = await supabase
        .from('rateations')
        .select(`
          is_f24, 
          status, 
          decadence_at, 
          taxpayer_name, 
          number,
          rateation_types!inner(name)
        `)
        .eq('id', parseInt(rateationId))
        .single();

      if (rateationError) {
        console.warn('Failed to load rateation info:', rateationError.message);
      } else {
        const typeName = (rateationData as any).rateation_types?.[0]?.name || 
                         (rateationData as any).rateation_types?.name || '';
        setRateationInfo({
          is_f24: rateationData.is_f24 || false,
          status: (rateationData.status || 'active') as RateationStatus,
          decadence_at: rateationData.decadence_at,
          taxpayer_name: rateationData.taxpayer_name,
          number: rateationData.number,
          type_name: typeName
        });
      }

    } catch (e: any) {
      setError(e?.message || "Errore nel caricamento rate");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [rateationId]);

  const { debouncedReload, debouncedReloadStats } = useDebouncedReload({
    loadData: load,
    reloadStats: () => onDataChanged?.()
  });

  useEffect(() => { 
    load(); 
  }, [load]);

  // Use pre-computed PagoPA KPIs from parent - no recalculation
  const unpaidOverdueToday = pagopaKpis?.unpaid_overdue_today ?? 0;
  const unpaidDueToday = pagopaKpis?.unpaid_due_today ?? 0;
  const skipMax = pagopaKpis?.max_skips_effective ?? 8;
  const skipRemaining = pagopaKpis?.skip_remaining ?? 0;
  
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
      await confirmDecadence(parseInt(rateationId), installmentId, reason);
      
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

  if (loading) return <div className="p-4 text-sm text-muted-foreground">Caricamento rate…</div>;
  if (error) return <div className="p-4 text-sm text-destructive">{error}</div>;
  if (!items.length) return <div className="p-4 text-sm text-muted-foreground">Nessuna rata trovata.</div>;

  return (
    <div className="p-4 space-y-4">
      {/* Decadence Alert */}
      {rateationInfo && (
        <DecadenceAlert
          rateationId={parseInt(rateationId)}
          isF24={Boolean(rateationInfo.is_f24) || String(rateationInfo.type_name).toUpperCase() === 'F24'}
          status={rateationInfo.status}
          installments={items}
          onConfirmDecadence={handleConfirmDecadence}
          onViewOverdueInstallments={handleViewOverdueInstallments}
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
        {rateationInfo?.type_name?.toUpperCase() === 'PAGOPA' && (
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border bg-card p-3">
              <div className="text-xs text-muted-foreground">Non pagate oggi</div>
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
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Allegati</div>
            <AttachmentsPanel rateationId={rateationId} />
          </div>
        </div>
      </div>

      {/* Sub-tabella rate con scroll */}
      <div className="border rounded-lg">
        <div className="max-h-80 overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background">
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Scadenza</TableHead>
                <TableHead className="text-right">Importo</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>Pagata il</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it) => {
                const daysLate = getDaysLate(it);

                // Show ravvedimento total if available, otherwise original amount
                const displayAmount = it.paid_total_cents 
                  ? it.paid_total_cents / 100 
                  : it.amount || 0;

                return (
                  <TableRow key={it.seq} className="hover:bg-muted/50">
                    <TableCell className="font-medium">{it.seq}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div>{it.due_date ? new Date(it.due_date).toLocaleDateString("it-IT") : "—"}</div>
                        {daysLate > 0 && (
                          <div className="text-xs text-destructive font-medium">
                            {daysLate} giorni di ritardo
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="space-y-1">
                        <div className="font-medium">{formatEuro(it.amount || 0)}</div>
                        {it.is_paid && it.paid_total_cents && it.paid_total_cents > 0 && (
                          <div className="text-xs text-muted-foreground">
                            tot. {formatEuro(it.paid_total_cents / 100)} ({formatEuro((it.paid_total_cents / 100) - (it.amount || 0))} extra)
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell><InstallmentStatusBadge installment={it} /></TableCell>
                    <TableCell>
                      {(() => {
                        const paidDate = getPaymentDate(it);
                        return paidDate ? new Date(paidDate).toLocaleDateString('it-IT') : '—';
                      })()}
                    </TableCell>
                    <TableCell>
                      <InstallmentPaymentActions
                        rateationId={rateationId}
                        installment={it}
                        onReload={debouncedReload}
                        onStatsReload={debouncedReloadStats}
                        disabled={!online || rateationInfo?.status === 'decaduta'}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end items-center">
                        {!isInstallmentPaid(it) && rateationInfo?.status !== 'decaduta' && (
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
                        {rateationInfo?.status !== 'decaduta' && (
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
                    </TableCell>
                  </TableRow>
                );
              })}
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">
                    Nessuna rata presente.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
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