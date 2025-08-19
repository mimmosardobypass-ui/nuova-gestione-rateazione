import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar as CalendarIcon, Plus, Save, X, ArrowRightLeft } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type Installment = {
  id: string;
  rateation_id: string;
  seq: number;
  due_date: string;  // yyyy-MM-dd
  amount: number;
  paid_at: string | null;
};

type Props = {
  rateationId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: () => void;
};

export default function EditScheduleModal({ rateationId, open, onOpenChange, onSaved }: Props) {
  const [rows, setRows] = useState<Installment[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const totals = useMemo(() => {
    const quota = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
    const cnt = rows.length;
    return { quota, cnt };
  }, [rows]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("installments")
          .select("id, rateation_id, seq, due_date, amount, paid_at")
          .eq("rateation_id", rateationId)
          .order("seq", { ascending: true });

        if (error) throw error;

        const mapped = (data || []).map((d: any) => ({
          id: d.id?.toString() || crypto.randomUUID(),
          rateation_id: d.rateation_id?.toString() || rateationId,
          seq: d.seq,
          due_date: d.due_date,
          amount: Number(d.amount || 0),
          paid_at: d.paid_at,
        })) as Installment[];

        setRows(mapped);
      } catch (error) {
        console.error("Error loading installments:", error);
        toast({
          title: "Errore",
          description: "Impossibile caricare le rate",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [open, rateationId, toast]);

  const setCell = (idx: number, patch: Partial<Installment>) => {
    setRows(prev => {
      const clone = [...prev];
      clone[idx] = { ...clone[idx], ...patch };
      return clone;
    });
  };

  const addRow = () => {
    const maxSeq = Math.max(0, ...rows.map(r => r.seq));
    setRows(prev => [...prev, {
      id: crypto.randomUUID(),
      rateation_id: rateationId,
      seq: maxSeq + 1,
      due_date: format(new Date(), "yyyy-MM-dd"),
      amount: 0,
      paid_at: null,
    }]);
  };

  const removeRow = (idx: number) => {
    setRows(prev => prev.filter((_, i) => i !== idx));
  };

  const shiftMonths = (delta: number) => {
    setRows(prev => prev.map(r => {
      if (r.paid_at) return r;
      const d = new Date(r.due_date);
      d.setMonth(d.getMonth() + delta);
      return { ...r, due_date: format(d, "yyyy-MM-dd") };
    }));
  };

  const setMonthDay = (day: number) => {
    setRows(prev => prev.map(r => {
      if (r.paid_at) return r;
      const d = new Date(r.due_date);
      const target = new Date(d.getFullYear(), d.getMonth(), day);
      return { ...r, due_date: format(target, "yyyy-MM-dd") };
    }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = rows.map(r => ({
        seq: r.seq,
        due_date: r.due_date,
        amount: r.amount
      }));

      const { error } = await supabase.rpc("apply_rateation_edits", {
        p_rateation_id: parseInt(rateationId),
        p_rows: payload
      });

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Modifiche salvate correttamente",
      });

      onOpenChange(false);
      onSaved?.();
    } catch (error) {
      console.error("Error saving edits:", error);
      toast({
        title: "Errore",
        description: "Errore nel salvataggio delle modifiche",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Modifica scadenze</DialogTitle>
        </DialogHeader>

        {/* Azioni massiche */}
        <div className="flex items-center gap-2 mb-2">
          <Button size="sm" variant="secondary" onClick={() => shiftMonths(-1)}>
            <ArrowRightLeft className="mr-2 h-4 w-4" /> -1 mese
          </Button>
          <Button size="sm" variant="secondary" onClick={() => shiftMonths(+1)}>
            <ArrowRightLeft className="mr-2 h-4 w-4" /> +1 mese
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setMonthDay(31)}>
            Fine mese
          </Button>
          <div className="ml-auto text-sm text-muted-foreground">
            Totale rate: <b>{totals.cnt}</b> &nbsp;•&nbsp; Somma: <b>{totals.quota.toLocaleString("it-IT", {minimumFractionDigits:2})} €</b>
          </div>
        </div>

        {/* Tabella */}
        <div className="border rounded overflow-hidden flex-1 flex flex-col min-h-0">
          <div className="grid grid-cols-[60px_140px_160px_1fr] bg-muted px-3 py-2 text-sm font-medium">
            <div>#</div>
            <div>Scadenza</div>
            <div>Importo</div>
            <div className="text-right">
              <Button size="sm" variant="ghost" onClick={addRow}>
                <Plus className="mr-1 h-4 w-4" /> Aggiungi
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="p-6 text-sm text-muted-foreground">Caricamento…</div>
            ) : (
              rows
                .sort((a, b) => a.seq - b.seq)
                .map((r, idx) => {
                  const isPaid = !!r.paid_at;
                  return (
                    <div 
                      key={r.id} 
                      className={cn(
                        "grid grid-cols-[60px_140px_160px_1fr] items-center px-3 py-2 border-t text-sm",
                        isPaid && "bg-muted/40"
                      )}
                    >
                      <div>
                        <Input
                          className="w-14 h-8"
                          type="number"
                          value={r.seq}
                          onChange={e => setCell(idx, { seq: Number(e.target.value) })}
                          disabled={isPaid}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="h-4 w-4 opacity-60" />
                        <Input
                          className="w-[110px] h-8"
                          type="date"
                          value={r.due_date}
                          onChange={e => setCell(idx, { due_date: e.target.value })}
                          disabled={isPaid}
                        />
                      </div>
                      <div>
                        <Input
                          className="w-[140px] h-8 text-right"
                          type="number"
                          step="0.01"
                          value={r.amount}
                          onChange={e => setCell(idx, { amount: Number(e.target.value) })}
                          disabled={isPaid}
                        />
                      </div>
                      <div className="text-right">
                        {isPaid ? (
                          <span className="text-xs text-muted-foreground">
                            Pagata il {format(new Date(r.paid_at!), "dd/MM/yyyy", { locale: it })}
                          </span>
                        ) : (
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => removeRow(idx)}
                            className="h-8 w-8 p-0"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button onClick={save} disabled={saving || loading}>
            <Save className="mr-2 h-4 w-4" /> 
            {saving ? "Salvataggio..." : "Salva modifiche"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}