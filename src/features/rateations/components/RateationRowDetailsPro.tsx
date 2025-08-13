import * as React from "react";
import { formatEuro } from "@/lib/formatters";
import { fetchInstallments, postponeInstallment, deleteInstallment } from "../api/installments";
import { StatusBadge, getInstallmentStatus, Installment } from "./Status";
import { AttachmentsPanel } from "./AttachmentsPanel";
import { InstallmentPaymentActions } from "./InstallmentPaymentActions";
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

interface RateationRowDetailsProProps {
  rateationId: string;
  onDataChanged?: () => void;
}

export function RateationRowDetailsPro({ rateationId, onDataChanged }: RateationRowDetailsProProps) {
  const [items, setItems] = React.useState<Installment[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [processing, setProcessing] = React.useState<{ [key: string]: boolean }>({});
  const { toast } = useToast();
  const online = useOnline();

  const load = React.useCallback(async () => {
    setLoading(true); 
    setError(null);
    try {
      const rows = await fetchInstallments(rateationId);
      setItems(rows ?? []);
    } catch (e: any) {
      setError(e?.message || "Errore nel caricamento rate");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [rateationId]);

  React.useEffect(() => { 
    load(); 
  }, [load]);


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
      {/* Header info compatto */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-4 border-b">
        {/* Meta info */}
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">Rate Overview</div>
          <div className="text-sm font-medium">Totale: {items.length}</div>
        </div>
        
        {/* KPI riassunto rate */}
        <div className="grid grid-cols-2 gap-2">
          <div className="text-center p-2 bg-green-50 rounded-md">
            <div className="text-xs text-muted-foreground">Pagate</div>
            <div className="font-semibold text-green-700">
              {items.filter(it => it.is_paid).length}
            </div>
          </div>
          <div className="text-center p-2 bg-red-50 rounded-md">
            <div className="text-xs text-muted-foreground">In ritardo</div>
            <div className="font-semibold text-red-700">
              {items.filter(it => {
                const status = getInstallmentStatus(it);
                return status === 'overdue';
              }).length}
            </div>
          </div>
        </div>
        
        {/* Allegati compatto */}
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">Allegati</div>
          <AttachmentsPanel rateationId={rateationId} />
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
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it) => {
                const status = getInstallmentStatus(it);
                const today = new Date();
                const dueDate = it.due_date ? new Date(it.due_date) : null;
                const daysLate = dueDate && status === 'overdue' 
                  ? Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
                  : 0;

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
                    <TableCell className="text-right font-medium">{formatEuro(it.amount || 0)}</TableCell>
                    <TableCell><StatusBadge status={status} /></TableCell>
                    <TableCell>
                      {it.paid_at ? new Date(it.paid_at).toLocaleDateString("it-IT") : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end items-center">
                        <InstallmentPaymentActions
                          rateationId={rateationId}
                          installment={{
                            seq: it.seq,
                            amount: it.amount || 0,
                            due_date: it.due_date || "",
                            is_paid: it.is_paid,
                            paid_at: it.paid_at,
                            postponed: it.postponed || false
                          }}
                          onReload={load}
                          onStatsReload={onDataChanged}
                          disabled={!online}
                        />
                        {!it.is_paid && (
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
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={() => handleDelete(it.seq)}
                          disabled={processing[`delete-${it.seq}`]}
                          className="h-7 px-2 text-xs"
                        >
                          {processing[`delete-${it.seq}`] ? "..." : "Elimina"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                    Nessuna rata presente.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}