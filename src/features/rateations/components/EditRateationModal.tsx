import * as React from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { useRateationTypes } from "../hooks/useRateationTypes";
import { fetchSingleRateation, updateRateation } from "../api/rateations";
import { useOnline } from "@/hooks/use-online";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  open: boolean;
  rateationId: string | null;
  onOpenChange: (v: boolean) => void;
  onSaved?: () => void;
};

export function EditRateationModal({ open, rateationId, onOpenChange, onSaved }: Props) {
  const online = useOnline();

  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [types, setTypes] = React.useState<{ id: number; name: string }[]>([]);

  const [numero, setNumero] = React.useState("");
  const [typeId, setTypeId] = React.useState<string | undefined>(undefined);
  const [contribuente, setContribuente] = React.useState("");
  const [totalAmount, setTotalAmount] = React.useState<string>("0");
  const [startDueDate, setStartDueDate] = React.useState<string>("");

  const rid = rateationId ? Number(rateationId) : null;

  const loadTypes = React.useCallback(async () => {
    const { data, error } = await supabase.from("rateation_types").select("id, name").order("name", { ascending: true });
    if (error) {
      console.error(error);
      toast({ title: "Errore", description: "Impossibile caricare i tipi.", variant: "destructive" });
      return;
    }
    setTypes((data || []).map((t) => ({ id: Number(t.id), name: String(t.name) })));
  }, []);

  const loadRateation = React.useCallback(async () => {
    if (!rid) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("rateations")
        .select("id, number, taxpayer_name, total_amount, start_due_date, type_id")
        .eq("id", rid)
        .single();
      if (error) throw error;
      setNumero(String(data?.number ?? ""));
      setTypeId(data?.type_id != null ? String(data.type_id) : undefined);
      setContribuente(String(data?.taxpayer_name ?? ""));
      setTotalAmount(String(Number(data?.total_amount ?? 0)));
      setStartDueDate(data?.start_due_date ? String(data.start_due_date) : "");
    } catch (e: any) {
      console.error(e);
      toast({ title: "Errore", description: "Impossibile caricare la rateazione.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [rid]);

  React.useEffect(() => {
    if (open) {
      // Load types and rateation in parallel
      Promise.all([loadTypes(), loadRateation()]).catch((e) => console.error(e));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rid]);

  const onSave = async () => {
    if (!online) {
      toast({ title: "Offline", description: "Sei offline: impossibile salvare.", variant: "destructive" });
      return;
    }
    if (!rid) return;
    if (!typeId) {
      toast({ title: "Seleziona un tipo", description: "È necessario selezionare un tipo.", variant: "destructive" });
      return;
    }
    if (saving) {
      toast({ title: "Operazione in corso", description: "Attendi il completamento del salvataggio", variant: "destructive" });
      return;
    }
    
    setSaving(true);
    try {
      const payload: any = {
        number: numero || null,
        type_id: Number(typeId),
        taxpayer_name: contribuente || null,
        total_amount: Number(totalAmount || "0"),
        start_due_date: startDueDate || null,
      };

      // Filter by id and owner_uid if available
      let query = supabase.from("rateations").update(payload).eq("id", rid);
      try {
        const { data: userData } = await supabase.auth.getUser();
        const uid = userData?.user?.id;
        if (uid) {
          query = query.eq("owner_uid", uid);
        }
      } catch (_) {}

      const { error } = await query;
      if (error) throw error;

      toast({ title: "Salvato", description: "Rateazione aggiornata con successo." });
      onOpenChange(false);
      onSaved?.();
    } catch (e: any) {
      console.error(e);
      toast({ title: "Errore", description: e?.message || "Impossibile salvare.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const disabled = !online || loading || saving;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Modifica rateazione</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="numero">Numero</Label>
              <Input id="numero" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Es. R-2025-003" disabled={disabled} />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={typeId} onValueChange={setTypeId}>
                <SelectTrigger aria-label="Seleziona tipo" disabled={disabled}>
                  <SelectValue placeholder="Seleziona tipo" />
                </SelectTrigger>
                <SelectContent>
                  {types.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contribuente">Contribuente</Label>
              <Input id="contribuente" value={contribuente} onChange={(e) => setContribuente(e.target.value)} placeholder="Es. Nome Cognome" disabled={disabled} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="total">Totale importo</Label>
              <Input id="total" type="number" min={0} value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} disabled={disabled} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="startdate">Data prima scadenza</Label>
              <Input id="startdate" type="date" value={startDueDate || ""} onChange={(e) => setStartDueDate(e.target.value)} disabled={disabled} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onSave} disabled={disabled}>
            {saving ? "Salvando..." : "Salva"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
