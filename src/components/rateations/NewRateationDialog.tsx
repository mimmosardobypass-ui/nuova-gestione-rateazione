import * as React from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOnline } from "@/hooks/use-online";
import { toast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";

export function NewRateationDialog({ onCreated }: { onCreated?: () => void }) {
  const [open, setOpen] = React.useState(false);
  const [tab] = React.useState<"auto" | "manual">("auto");

  // Auto
  const [numRate, setNumRate] = React.useState(6);
  const [amountPerRate, setAmountPerRate] = React.useState(400);
  const [firstDue, setFirstDue] = React.useState<string>(new Date().toISOString().slice(0, 10));

  // Common
  const [numero, setNumero] = React.useState("");
  const [tipo, setTipo] = React.useState<string | undefined>(undefined);
  const [contribuente, setContribuente] = React.useState("");

  const [types, setTypes] = React.useState<{ id: number; name: string }[]>([]);
  const online = useOnline();

  const loadTypes = async () => {
    const { data, error } = await supabase.from("rateation_types").select("id, name").order("name", { ascending: true });
    if (error) return toast({ title: "Errore", description: error.message, variant: "destructive" });
    setTypes((data || []).map((d: any) => ({ id: Number(d.id), name: String(d.name) })));
  };

  React.useEffect(() => {
    if (open) loadTypes();
  }, [open]);

  const addNewType = async () => {
    if (!online) return toast({ title: "Offline", description: "Impossibile creare un nuovo tipo.", variant: "destructive" });
    const name = window.prompt("Nome nuovo tipo:");
    if (!name) return;
    const { data, error } = await supabase.from("rateation_types").insert({ name }).select("id").single();
    if (error) return toast({ title: "Errore", description: error.message, variant: "destructive" });
    await loadTypes();
    setTipo(String(data?.id));
    toast({ title: "Tipo creato" });
  };

  const saveAuto = async () => {
    if (!online) return toast({ title: "Offline", description: "Impossibile salvare.", variant: "destructive" });
    if (!tipo) return toast({ title: "Seleziona un tipo", description: "Seleziona un tipo prima di salvare.", variant: "destructive" });

    const p_type_id = Number(tipo);
    const p_number = numero?.trim() || `R-${new Date().toISOString().slice(0, 10)}-${Math.floor(Math.random() * 1000)}`;
    const p_taxpayer_name = contribuente || null;
    const p_start_due_date = firstDue;
    const p_frequency = "monthly";
    const p_num_installments = Number(numRate);
    const p_amount_per_installment = Number(amountPerRate);

    const { data, error } = await supabase.rpc("fn_create_rateation_auto", {
      p_number,
      p_type_id,
      p_taxpayer_name,
      p_start_due_date,
      p_frequency,
      p_num_installments,
      p_amount_per_installment,
    });

    if (error) return toast({ title: "Errore", description: error.message, variant: "destructive" });

    toast({ title: "Rateazione creata", description: `ID ${data}` });
    setOpen(false);
    onCreated?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Nuova rateazione</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[640px] z-[1000] p-0">
        <div className="flex flex-col max-h-[80vh]">
          <DialogHeader className="p-4 border-b">
            <DialogTitle>Nuova rateazione</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div>
              <Label>Numero (opz.)</Label>
              <Input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Es. R-2025-003" />
            </div>

            <div>
              <Label>Tipo</Label>
              <div className="flex items-center gap-2">
                <Select value={tipo} onValueChange={setTipo}>
                  <SelectTrigger><SelectValue placeholder="Seleziona tipo" /></SelectTrigger>
                  <SelectContent>
                    {types.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={addNewType} disabled={!online}>Nuovo tipo</Button>
              </div>
            </div>

            <div>
              <Label>Contribuente (opz.)</Label>
              <Input value={contribuente} onChange={(e) => setContribuente(e.target.value)} placeholder="Es. Mario Rossi" />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label>Numero rate</Label>
                <Input type="number" min={1} value={numRate} onChange={(e) => setNumRate(parseInt(e.target.value || "0"))} />
              </div>
              <div>
                <Label>Importo per rata</Label>
                <Input type="number" step="0.01" min={0} value={amountPerRate} onChange={(e) => setAmountPerRate(parseFloat(e.target.value || "0"))} />
              </div>
              <div>
                <Label>Prima scadenza</Label>
                <Input type="date" value={firstDue} onChange={(e) => setFirstDue(e.target.value)} />
              </div>
            </div>

            <div className="text-sm text-muted-foreground">
              Totale calcolato: <b>{(numRate * amountPerRate).toLocaleString("it-IT", { style: "currency", currency: "EUR" })}</b>
            </div>
          </div>

          <DialogFooter className="sticky bottom-0 bg-background p-4 border-t">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Annulla
            </Button>
            <Button onClick={saveAuto} disabled={!online}>
              Salva (Automatico)
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}