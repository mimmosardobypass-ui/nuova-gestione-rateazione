import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Save, X, ArrowRightLeft } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { toLocalISO, formatISOToItalian, isValidISODate } from "@/utils/date";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { toIntId } from "@/lib/utils/ids";
import DateCellPickerFlat from "@/components/ui/date-cell-picker-flat";

// Helper functions for Italian date/amount parsing
const euroToNumber = (txt: string): number => {
  if (typeof txt !== 'string') return Number(txt) || 0;
  const clean = txt.replace(/\./g, '').replace(',', '.'); // "1.773,24" -> "1773.24"
  const n = Number(clean);
  return Number.isFinite(n) ? n : NaN;
};

const formatIT = (n: number): string =>
  new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .format(n);

type Row = {
  seq: number;
  due_date_iso: string;  // Internal ISO format (YYYY-MM-DD)
  amount: string;        // Italian format for UI, es. "1.773,24"
  paid?: boolean;        // se pagata -> riga bloccata
  id?: string;
  rateation_id?: string;
  paid_at?: string | null;
};

type RowError = {
  date?: string;        // messaggio errore
  amount?: string;      // messaggio errore
};

type Props = {
  rateationId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: () => void;
};

export default function EditScheduleModal({ rateationId, open, onOpenChange, onSaved }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<number, RowError>>({});
  const { toast } = useToast();

  const totals = useMemo(() => {
    const quota = rows.reduce((s, r) => s + euroToNumber(r.amount || '0'), 0);
    const cnt = rows.length;
    return { quota, cnt };
  }, [rows]);

  // Validazione live avanzata
  useEffect(() => {
    const map: Record<number, RowError> = {};
    const datesSeen = new Set<string>();
    const validDates: { idx: number; date: Date; iso: string }[] = [];

    rows.forEach((r, idx) => {
      const e: RowError = {};

      // Controllo rate pagate - non modificabili
      if (r.paid && r.due_date_iso !== r.due_date_iso) {
        e.date = 'Rate pagate non modificabili';
      }

      // Validazione date
      if (!r.due_date_iso || !r.due_date_iso.trim()) {
        e.date = 'Data obbligatoria';
      } else if (!isValidISODate(r.due_date_iso)) {
        e.date = 'Data non valida (usa gg/mm/aaaa)';
      } else {
        // Controllo duplicati
        if (datesSeen.has(r.due_date_iso)) {
          e.date = 'Data duplicata';
        } else {
          datesSeen.add(r.due_date_iso);
          validDates.push({ idx, date: new Date(r.due_date_iso), iso: r.due_date_iso });
        }
      }

      // Validazione importi
      const n = euroToNumber(r.amount);
      if (!Number.isFinite(n) || n <= 0) {
        e.amount = 'Importo non valido o zero';
      }

      if (e.date || e.amount) map[idx] = e;
    });

    // Controllo ordine cronologico per date valide
    validDates.sort((a, b) => a.date.getTime() - b.date.getTime());
    for (let i = 0; i < validDates.length - 1; i++) {
      const current = validDates[i];
      const next = validDates[i + 1];
      const originalIndex = rows.findIndex((r, idx) => idx === current.idx);
      const nextOriginalIndex = rows.findIndex((r, idx) => idx === next.idx);
      
      if (originalIndex > nextOriginalIndex) {
        if (!map[current.idx]) map[current.idx] = {};
        map[current.idx].date = 'Date non in ordine cronologico';
      }
    }

    setErrors(map);
  }, [rows]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("installments")
          .select("id, rateation_id, seq, due_date, amount, paid_at")
          .eq("rateation_id", toIntId(rateationId, 'rateationId'))
          .order("seq", { ascending: true });

        if (error) throw error;

        const mapped = (data || []).map((d: any) => ({
          id: d.id?.toString() || crypto.randomUUID(),
          rateation_id: d.rateation_id?.toString() || rateationId,
          seq: d.seq,
          due_date_iso: d.due_date,  // Keep ISO in state
          amount: formatIT(Number(d.amount || 0)),
          paid_at: d.paid_at,
          paid: !!d.paid_at,
        })) as Row[];

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

  const setCell = (idx: number, patch: Partial<Row>) => {
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
      due_date_iso: format(new Date(), "yyyy-MM-dd"),
      amount: '0,00',
      paid_at: null,
      paid: false,
    }]);
  };

  const removeRow = (idx: number) => {
    setRows(prev => prev.filter((_, i) => i !== idx));
  };

  const shiftMonths = (delta: number) => {
    setRows(prev => prev.map(r => {
      if (r.paid) return r;
      const d = new Date(r.due_date_iso);
      d.setMonth(d.getMonth() + delta);
      return { ...r, due_date_iso: format(d, "yyyy-MM-dd") };
    }));
  };

  const setMonthDay = (day: number) => {
    setRows(prev => prev.map(r => {
      if (r.paid) return r;
      const d = new Date(r.due_date_iso);
      const target = new Date(d.getFullYear(), d.getMonth(), day);
      return { ...r, due_date_iso: format(target, "yyyy-MM-dd") };
    }));
  };

  const save = async () => {
    // Blocca se errori
    if (Object.keys(errors).length > 0) {
      const errorCount = Object.keys(errors).length;
      toast({
        title: "Impossibile salvare",
        description: `Risolvi prima ${errorCount} errore${errorCount > 1 ? 'i' : ''} di validazione`,
        variant: "destructive",
      });
      return;
    }

    // Controllo aggiuntivo: almeno una rata
    if (rows.length === 0) {
      toast({
        title: "Errore",
        description: "Inserisci almeno una rata",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      // Solo righe NON pagate
      const payload = rows
        .filter(r => !r.paid)
        .map(r => ({
          seq: Number(r.seq),
          due_date: r.due_date_iso, // Already in ISO format
          amount: euroToNumber(r.amount).toString(), // "1773.24"
        }));

      const { error } = await supabase.rpc("apply_rateation_edits", {
        p_rateation_id: toIntId(rateationId, 'rateationId'),
        p_rows: payload
      });

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Rate salvate e riepilogo ricalcolato",
      });

      onOpenChange(false);
      onSaved?.();
    } catch (err: any) {
      console.error('[apply_rateation_edits] error:', err);
      toast({
        title: "Errore",
        description: `Errore nel salvataggio: ${err?.message || 'sconosciuto'}`,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-visible flex flex-col dialog-content-flatpickr">
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
            Totale rate: <b>{totals.cnt}</b> &nbsp;•&nbsp; Somma: <b>{formatIT(totals.quota)} €</b>
          </div>
        </div>

        {/* Alert errori */}
        {Object.keys(errors).length > 0 && (
          <div className="mb-2 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
            <div className="font-medium mb-1">Errori rilevati ({Object.keys(errors).length} righe):</div>
            <ul className="text-xs space-y-1 ml-2">
              {Object.entries(errors).map(([idx, err]) => (
                <li key={idx}>
                  Riga {Number(idx) + 1}: {err.date && `${err.date}`}{err.date && err.amount && ' • '}{err.amount && `${err.amount}`}
                </li>
              ))}
            </ul>
          </div>
        )}

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
                  const isPaid = !!r.paid;
                  const e = errors[idx] || {};
                  const dateError = !!e.date;
                  const amountError = !!e.amount;

                  return (
                    <div key={r.id || idx}>
                      <div 
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
                        <div className={cn(
                          dateError && "border-destructive ring-1 ring-destructive/40 rounded"
                        )}>
                          <DateCellPickerFlat
                            value={r.due_date_iso}
                            onChange={(date) => {
                              if (date) {
                                setCell(idx, { due_date_iso: toLocalISO(date) });
                              } else {
                                setCell(idx, { due_date_iso: "" });
                              }
                            }}
                            disabled={isPaid}
                            className="w-auto"
                          />
                        </div>
                        <div>
                          <Input
                            className={cn(
                              "w-[140px] h-8 text-right tabular-nums",
                              amountError && "border-destructive ring-1 ring-destructive/40"
                            )}
                            value={r.amount}
                            onChange={e => setCell(idx, { amount: e.target.value })}
                            onBlur={() => {
                              const n = euroToNumber(r.amount);
                              if (Number.isFinite(n)) {
                                setCell(idx, { amount: formatIT(n) });
                              }
                            }}
                            disabled={isPaid}
                          />
                        </div>
                        <div className="text-right">
                          {isPaid ? (
                            <span className="text-xs text-muted-foreground">
                              Pagata il {r.paid_at ? 
                                format(new Date(r.paid_at), "dd/MM/yyyy", { locale: it }) : 
                                '—'
                              }
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
                      {/* Errori inline */}
                      {(dateError || amountError) && (
                        <div className="grid grid-cols-[60px_140px_160px_1fr] px-3 pb-2 text-[11px] text-destructive">
                          <div></div>
                          <div>{dateError && e.date}</div>
                          <div>{amountError && e.amount}</div>
                          <div></div>
                        </div>
                      )}
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
          <Button onClick={save} disabled={saving || loading || Object.keys(errors).length > 0}>
            <Save className="mr-2 h-4 w-4" /> 
            {saving ? "Salvataggio..." : "Salva modifiche"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}