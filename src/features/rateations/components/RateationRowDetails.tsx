import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { useOnline } from "@/hooks/use-online";
import { useEffect, useMemo, useState, useCallback } from "react";
import { RateationRow, InstallmentUI } from "../types";
import { AttachmentsPanel } from "./AttachmentsPanel";
import { postponeInstallment, fetchInstallments } from "../api/installments";
import { formatEuro } from "@/lib/formatters";
import { InstallmentPaymentActions } from "./InstallmentPaymentActions";
import { InstallmentStatusBadge } from "./InstallmentStatusBadge";

export function RateationRowDetails({ row, onDataChanged }: { row: RateationRow; onDataChanged?: () => void }) {
  const [items, setItems] = useState<InstallmentUI[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [postponing, setPostponing] = useState<number | null>(null);
  const online = useOnline();

  const loadInstallments = useCallback(async () => {
    if (!row?.id || !online) return;
    
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    
    try {
      const data = await fetchInstallments(row.id, controller.signal);
      
      if (controller.signal.aborted) return;
      setItems(data || []);
    } catch (err) {
      if (controller.signal.aborted || (err instanceof Error && err.message === 'AbortError')) {
        console.debug('[ABORT] RateationRowDetails loadInstallments');
        return;
      }
      const message = err instanceof Error ? err.message : "Errore nel caricamento";
      setError(message);
      console.error("Error loading installments:", err);
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
    
    return () => controller.abort();
  }, [row?.id, online]);

  useEffect(() => {
    const cleanup = loadInstallments();
    return () => {
      if (cleanup instanceof Function) cleanup();
    };
  }, [loadInstallments]);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const withStatus = useMemo(() => {
    return items.map((it) => {
      const late = !it.is_paid && it.due_date !== null && (() => {
        const dueDate = new Date(it.due_date);
        dueDate.setHours(0, 0, 0, 0);
        return dueDate < today;
      })();
      return {
        ...it,
        status: it.is_paid ? "Pagata" : late ? "In ritardo" : "Da pagare",
      };
    });
  }, [items, today]);


  const postpone = async (seq: number) => {
    if (!online) {
      toast({ title: "Offline", description: "Impossibile posticipare offline.", variant: "destructive" });
      return;
    }

    if (postponing) {
      toast({ title: "Operazione in corso", description: "Attendi il completamento", variant: "destructive" });
      return;
    }

    const newDue = prompt("Nuova data di scadenza (YYYY-MM-DD):");
    if (!newDue) return;

    setPostponing(seq);
    try {
      await postponeInstallment(row.id, seq, newDue);
      toast({ title: "Rata posticipata", description: `Nuova scadenza: ${newDue}` });
      await loadInstallments();
      onDataChanged?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Errore nel posticipare";
      toast({ title: "Errore", description: message, variant: "destructive" });
    } finally {
      setPostponing(null);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="card-elevated lg:col-span-2">
        <CardHeader>
          <CardTitle>Rate</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading && <p className="text-sm text-muted-foreground">Caricamento rate…</p>}
          {error && <p className="text-sm text-red-600">Errore: {error}</p>}
          {!loading && withStatus.length === 0 && <div className="border rounded-md p-3 text-sm">Nessuna rata.</div>}
          {withStatus.map((it) => (
            <div key={it.seq} className="flex flex-wrap items-center justify-between gap-4 border rounded-md p-4">
              <div className="flex items-center gap-3">
                <Badge variant="secondary"># {it.seq}</Badge>
                <div>
                  <div className="font-medium">Scadenza: {it.due_date ?? "-"}</div>
                  <div className="text-sm text-muted-foreground">Importo: {formatEuro(it.amount)}</div>
                </div>
              </div>
              
              <InstallmentStatusBadge installment={it} />
              
              <div className="flex flex-col gap-2 min-w-0">
                <InstallmentPaymentActions
                  rateationId={row.id}
                  installment={it}
                  onReload={loadInstallments}
                  onStatsReload={onDataChanged}
                  disabled={!online}
                />
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    disabled={!online || postponing === it.seq} 
                    onClick={() => postpone(it.seq)}
                  >
                    {postponing === it.seq ? "..." : "Posticipa"}
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => toast({ title: "Elimina rata", description: "Consentita solo per manuali" })}
                  >
                    Elimina
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <AttachmentsPanel rateationId={row.id} />
    </div>
  );
}