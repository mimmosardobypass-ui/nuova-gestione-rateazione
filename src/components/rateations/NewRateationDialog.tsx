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
      <DialogContent className="md:max-w-[820px] sm:max-w-[720px] p-0 md:overflow-visible">
        <DialogHeader className="p-5 border-b">
          <DialogTitle className="text-xl">Nuova rateazione</DialogTitle>
        </DialogHeader>

        <div className="p-5 md:max-h-none md:overflow-visible max-h-[75vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Numero */}
            <div className="col-span-1 md:col-span-2">
              <Label className="text-xs">Numero (opz.)</Label>
              <Input className="h-9" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Es. R-2025-003" />
            </div>

            {/* Tipo + Nuovo tipo allineati */}
            <div className="col-span-1">
              <Label className="text-xs">Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder="Seleziona tipo" />
                </SelectTrigger>
                <SelectContent>
                  {types.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-1 flex items-end">
              <Button variant="outline" className="h-9" onClick={addNewType} disabled={!online}>
                Nuovo tipo
              </Button>
            </div>

            {/* Contribuente */}
            <div className="col-span-1 md:col-span-2">
              <Label className="text-xs">Contribuente (opz.)</Label>
              <Input className="h-9" value={contribuente} onChange={(e) => setContribuente(e.target.value)} placeholder="Es. Mario Rossi" />
            </div>

            {/* Parametri rata: sempre in una riga su md+ */}
            <div>
              <Label className="text-xs">Numero rate</Label>
              <Input className="h-9" type="number" min={1} value={numRate} onChange={(e) => setNumRate(parseInt(e.target.value || "0"))} />
            </div>
            <div>
              <Label className="text-xs">Importo per rata</Label>
              <Input className="h-9" type="number" step="0.01" min={0} value={amountPerRate} onChange={(e) => setAmountPerRate(parseFloat(e.target.value || "0"))} />
            </div>
            <div>
              <Label className="text-xs">Prima scadenza</Label>
              <Input className="h-9" type="date" value={firstDue} onChange={(e) => setFirstDue(e.target.value)} />
            </div>

            {/* Totale calcolato, testo discreto */}
            <div className="md:col-span-2 text-sm text-muted-foreground">
              Totale calcolato: <b>{(numRate * amountPerRate).toLocaleString("it-IT", { style: "currency", currency: "EUR" })}</b>
            </div>
          </div>
        </div>

        <DialogFooter className="p-5 border-t">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Annulla
          </Button>
          <Button onClick={saveAuto} disabled={!online}>
            Salva (Automatico)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}