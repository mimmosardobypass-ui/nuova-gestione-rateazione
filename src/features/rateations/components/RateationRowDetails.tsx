import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { useOnline } from "@/hooks/use-online";
import { useEffect, useMemo, useState } from "react";
import { RateationRow, InstallmentUI } from "../types";
import { AttachmentsPanel } from "./AttachmentsPanel";
import { markInstallmentPaid, postponeInstallment, fetchInstallments } from "../api/installments";
import { formatEuro } from "@/lib/formatters";

export function RateationRowDetails({ row, onDataChanged }: { row: RateationRow; onDataChanged?: () => void }) {
  const [items, setItems] = useState<InstallmentUI[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const online = useOnline();

  const loadInstallments = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchInstallments(row.id);
      setItems(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Errore nel caricamento";
      setError(message);
      console.error("Error loading installments:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInstallments();
  }, [row.id]);

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

  const markPaid = async (seq: number) => {
    if (!online) {
      toast({ title: "Offline", description: "Impossibile marcare come pagata offline.", variant: "destructive" });
      return;
    }

    try {
      await markInstallmentPaid(row.id, seq, true, new Date().toISOString().slice(0, 10));
      toast({ title: "Pagamento registrato", description: "Rata marcata come pagata" });
      await loadInstallments();
      onDataChanged?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Errore nel marcare come pagata";
      toast({ title: "Errore", description: message, variant: "destructive" });
    }
  };

  const postpone = async (seq: number) => {
    if (!online) {
      toast({ title: "Offline", description: "Impossibile posticipare offline.", variant: "destructive" });
      return;
    }

    const newDue = prompt("Nuova data di scadenza (YYYY-MM-DD):");
    if (!newDue) return;

    try {
      await postponeInstallment(row.id, seq, newDue);
      toast({ title: "Rata posticipata", description: `Nuova scadenza: ${newDue}` });
      await loadInstallments();
      onDataChanged?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Errore nel posticipare";
      toast({ title: "Errore", description: message, variant: "destructive" });
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
            <div key={it.seq} className="flex flex-wrap items-center justify-between gap-2 border rounded-md p-3">
              <div className="flex items-center gap-3">
                <Badge variant="secondary"># {it.seq}</Badge>
                <div>
                  <div className="font-medium">Scadenza: {it.due_date ?? "-"}</div>
                  <div className="text-sm text-muted-foreground">Importo: {formatEuro(it.amount)}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge>{it.status}</Badge>
                {it.postponed && <Badge variant="outline">Rimandata</Badge>}
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" disabled={!online} onClick={() => markPaid(it.seq)}>
                  Segna pagata
                </Button>
                <Button size="sm" variant="outline" disabled={!online} onClick={() => postpone(it.seq)}>
                  Posticipa
                </Button>
                <Button size="sm" variant="ghost" onClick={() => toast({ title: "Elimina rata", description: "Consentita solo per manuali" })}>
                  Elimina
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <AttachmentsPanel rateationId={row.id} />
    </div>
  );
}