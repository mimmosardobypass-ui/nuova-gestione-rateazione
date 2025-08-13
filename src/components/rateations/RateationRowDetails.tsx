
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RateationRow } from "./RateationsTable";
import { toast } from "@/hooks/use-toast";
import { AttachmentsPanel } from "./AttachmentsPanel";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useState } from "react";
import { useOnline } from "@/hooks/use-online";

type InstallmentUI = {
  seq: number;
  due: string | null;
  paidAt: string | null;
  amount: number;
  isPaid: boolean;
  postponed: boolean;
};

export function RateationRowDetails({ row }: { row: RateationRow }) {
  const [items, setItems] = useState<InstallmentUI[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const online = useOnline();

  const loadInstallments = async () => {
    setLoading(true);
    setError(null);
    try {
      const rid = Number(row.id);
      const { data, error } = await supabase
        .from("installments")
        .select("seq, due_date, paid_at, amount, is_paid, postponed")
        .eq("rateation_id", rid)
        .order("seq", { ascending: true });

      if (error) throw error;

      const mapped: InstallmentUI[] = (data || []).map((it) => ({
        seq: Number(it.seq),
        due: it.due_date ? String(it.due_date) : null,
        paidAt: it.paid_at ? String(it.paid_at) : null,
        amount: Number(it.amount ?? 0),
        isPaid: it.is_paid === true,
        postponed: it.postponed === true,
      }));
      setItems(mapped);
    } catch (e: any) {
      console.error("[RateationRowDetails] Load installments error:", e);
      setError(e?.message || "Errore nel caricamento delle rate");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInstallments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.id]);

  const todayISO = new Date().toISOString().slice(0, 10);
  const euro = (n: number) => n.toLocaleString("it-IT", { style: "currency", currency: "EUR" });

  const withStatus = useMemo(() => {
    return items.map((it) => {
      const late = !it.isPaid && it.due !== null && it.due < todayISO;
      return {
        ...it,
        status: it.isPaid ? "Pagata" : late ? "In ritardo" : "Da pagare",
      };
    });
  }, [items, todayISO]);

  const markPaid = async (seq: number) => {
    if (!online) {
      toast({ title: "Offline", description: "Sei offline: impossibile segnare come pagata.", variant: "destructive" });
      return;
    }
    const rid = Number(row.id);
    console.log("[RateationRowDetails] Mark paid", { rid, seq });
    const { error } = await supabase.rpc("fn_set_installment_paid", {
      p_rateation_id: rid,
      p_seq: seq,
      p_paid: true,
      p_paid_at: new Date().toISOString().slice(0, 10),
    });
    if (error) {
      console.error(error);
      toast({ title: "Errore", description: "Impossibile segnare come pagata.", variant: "destructive" });
      return;
    }
    toast({ title: "Segnata pagata" });
    await loadInstallments();
  };

  const postpone = async (seq: number) => {
    if (!online) {
      toast({ title: "Offline", description: "Sei offline: impossibile posticipare.", variant: "destructive" });
      return;
    }
    const input = window.prompt("Nuova data di scadenza (YYYY-MM-DD):");
    if (!input) return;
    const isValid = /^\d{4}-\d{2}-\d{2}$/.test(input);
    if (!isValid) {
      toast({ title: "Formato non valido", description: "Usa il formato YYYY-MM-DD.", variant: "destructive" });
      return;
    }
    const rid = Number(row.id);
    console.log("[RateationRowDetails] Postpone", { rid, seq, new_due: input });
    const { error } = await supabase.rpc("fn_postpone_installment", {
      p_rateation_id: rid,
      p_seq: seq,
      p_new_due: input,
    });
    if (error) {
      console.error(error);
      toast({ title: "Errore", description: "Impossibile posticipare la rata.", variant: "destructive" });
      return;
    }
    toast({ title: "Rata posticipata" });
    await loadInstallments();
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
                  <div className="font-medium">Scadenza: {it.due ?? "-"}</div>
                  <div className="text-sm text-muted-foreground">Importo: {euro(it.amount)}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge>{it.status}</Badge>
                {it.postponed && <Badge variant="outline">Rimandata</Badge>}
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" disabled={!online} onClick={() => markPaid(it.seq)}>Segna pagata</Button>
                <Button size="sm" variant="outline" disabled={!online} onClick={() => postpone(it.seq)}>Posticipa</Button>
                <Button size="sm" variant="ghost" onClick={() => toast({ title: "Elimina rata", description: "Consentita solo per manuali" })}>Elimina</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <AttachmentsPanel rateationId={row.id} />
    </div>
  );
}
