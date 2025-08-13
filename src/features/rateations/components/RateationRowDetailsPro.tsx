import * as React from "react";
import { formatEuro } from "@/lib/formatters";
import { fetchInstallments, markInstallmentPaid, postponeInstallment, deleteInstallment } from "../api/installments";
import { StatusBadge, getInstallmentStatus, Installment } from "./Status";
import { AttachmentsPanel } from "./AttachmentsPanel";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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

  const handleMarkPaid = async (seq: number) => {
    if (!online) {
      toast({
        title: "Offline",
        description: "Connettiti a internet per modificare lo stato delle rate",
        variant: "destructive"
      });
      return;
    }

    const key = `paid-${seq}`;
    if (processing[key]) return;

    setProcessing(prev => ({ ...prev, [key]: true }));
    
    try {
      await markInstallmentPaid(rateationId, seq, true);
      await load();
      onDataChanged?.();
      toast({
        title: "Successo",
        description: "Rata segnata come pagata"
      });
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Errore nell'aggiornamento",
        variant: "destructive"
      });
    } finally {
      setProcessing(prev => ({ ...prev, [key]: false }));
    }
  };

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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-4">
      {/* Piano Rate */}
      <Card className="p-4">
        <h4 className="font-medium mb-3">Piano Rate</h4>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Scadenza</TableHead>
              <TableHead className="text-right">Importo</TableHead>
              <TableHead>Stato</TableHead>
              <TableHead>Pagata il</TableHead>
              <TableHead>Azioni</TableHead>
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
                <TableRow key={it.seq}>
                  <TableCell>{it.seq}</TableCell>
                  <TableCell>
                    <div>
                      {it.due_date ? new Date(it.due_date).toLocaleDateString("it-IT") : "—"}
                      {daysLate > 0 && (
                        <div className="text-xs text-destructive">
                          {daysLate} giorni di ritardo
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{formatEuro(it.amount || 0)}</TableCell>
                  <TableCell><StatusBadge status={status} /></TableCell>
                  <TableCell>
                    {it.paid_at ? new Date(it.paid_at).toLocaleDateString("it-IT") : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {!it.is_paid && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleMarkPaid(it.seq)}
                          disabled={processing[`paid-${it.seq}`]}
                        >
                          {processing[`paid-${it.seq}`] ? "..." : "Pagata"}
                        </Button>
                      )}
                      {!it.is_paid && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handlePostpone(it.seq)}
                          disabled={processing[`postpone-${it.seq}`]}
                        >
                          {processing[`postpone-${it.seq}`] ? "..." : "Posticipa"}
                        </Button>
                      )}
                      <Button 
                        size="sm" 
                        variant="destructive"
                        onClick={() => handleDelete(it.seq)}
                        disabled={processing[`delete-${it.seq}`]}
                      >
                        {processing[`delete-${it.seq}`] ? "..." : "Elimina"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Allegati */}
      <AttachmentsPanel rateationId={rateationId} />
    </div>
  );
}