import * as React from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Plus } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useOnline } from "@/hooks/use-online";

export function NewRateationDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated?: () => void }) {
  const [tab, setTab] = React.useState("auto");

  // Auto
  const [numRate, setNumRate] = React.useState<number>(6);
  const [amountPerRate, setAmountPerRate] = React.useState<number>(400);
  const [firstDue, setFirstDue] = React.useState<Date | undefined>(new Date());

  // Common
  const [numero, setNumero] = React.useState("");
  const [tipo, setTipo] = React.useState<string | undefined>(undefined);
  const [contribuente, setContribuente] = React.useState("");

  const [types, setTypes] = React.useState<{ id: number; name: string }[]>([]);
  const online = useOnline();

  const total = numRate * amountPerRate;

  const loadTypes = async () => {
    console.log("[NewRateationDialog] Loading rateation types...");
    const { data, error } = await supabase.from("rateation_types").select("id, name").order("name", { ascending: true });
    if (error) {
      console.error(error);
      toast({ title: "Errore", description: "Impossibile caricare i tipi.", variant: "destructive" });
      return;
    }
    setTypes((data || []).map(d => ({ id: Number(d.id), name: String(d.name) })));
  };

  React.useEffect(() => {
    if (open) loadTypes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const addNewType = async () => {
    if (!online) {
      toast({ title: "Offline", description: "Sei offline: impossibile creare un nuovo tipo.", variant: "destructive" });
      return;
    }
    const name = window.prompt("Nome nuovo tipo:");
    if (!name) return;
    const { data, error } = await supabase.from("rateation_types").insert({ name }).select("id").single();
    if (error) {
      console.error(error);
      toast({ title: "Errore", description: "Impossibile creare il tipo.", variant: "destructive" });
      return;
    }
    await loadTypes();
    setTipo(String(data?.id));
    toast({ title: "Tipo creato" });
  };

  const saveAuto = async () => {
    if (!online) {
      toast({ title: "Offline", description: "Sei offline: impossibile salvare.", variant: "destructive" });
      return;
    }
    if (!tipo) {
      toast({ title: "Seleziona un tipo", description: "È necessario selezionare un tipo prima di salvare.", variant: "destructive" });
      return;
    }
    const p_type_id = Number(tipo);
    const p_number = numero && numero.trim().length > 0 ? numero.trim() : `R-${new Date().toISOString().slice(0,10)}-${Math.floor(Math.random()*1000)}`;
    const p_taxpayer_name = contribuente || null;
    const p_start_due_date = (firstDue ?? new Date()).toISOString().slice(0, 10);
    const p_frequency = "monthly";
    const p_num_installments = Number(numRate);
    const p_amount_per_installment = Number(amountPerRate);

    console.log("[NewRateationDialog] Creating rateation via RPC fn_create_rateation_auto", {
      p_number, p_type_id, p_taxpayer_name, p_start_due_date, p_frequency, p_num_installments, p_amount_per_installment
    });

    const { data, error } = await supabase.rpc("fn_create_rateation_auto", {
      p_number,
      p_type_id,
      p_taxpayer_name,
      p_start_due_date,
      p_frequency,
      p_num_installments,
      p_amount_per_installment,
    });

    if (error) {
      console.error(error);
      toast({ title: "Errore", description: "Impossibile creare la rateazione.", variant: "destructive" });
      return;
    }

    toast({ title: "Rateazione creata", description: `ID ${data}` });
    onOpenChange(false);
    onCreated?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <div />
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nuova rateazione</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="numero">Numero (opz.)</Label>
              <Input id="numero" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Es. R-2025-003" />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <div className="flex gap-2">
                <Select value={tipo} onValueChange={setTipo}>
                  <SelectTrigger aria-label="Seleziona tipo">
                    <SelectValue placeholder="Seleziona tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {types.map(t => (
                      <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" aria-label="Nuovo tipo" onClick={addNewType} disabled={!online}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contribuente">Contribuente (opz.)</Label>
              <Input id="contribuente" value={contribuente} onChange={(e) => setContribuente(e.target.value)} placeholder="Es. Mario Rossi" />
            </div>
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="auto">Automatico</TabsTrigger>
              <TabsTrigger value="manuale">Manuale</TabsTrigger>
            </TabsList>
            <TabsContent value="auto" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="numrate">Numero rate</Label>
                  <Input id="numrate" type="number" min={1} value={numRate} onChange={(e) => setNumRate(parseInt(e.target.value || "0"))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">Importo per rata</Label>
                  <Input id="amount" type="number" min={0} value={amountPerRate} onChange={(e) => setAmountPerRate(parseFloat(e.target.value || "0"))} />
                </div>
                <div className="space-y-2">
                  <Label>Prima scadenza</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant={"outline"} className="justify-start font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {firstDue ? format(firstDue, "dd/MM/yyyy") : <span>Scegli una data</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={firstDue} onSelect={setFirstDue} initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="text-sm text-muted-foreground">Totale calcolato: <span className="font-medium text-foreground">€ {total.toLocaleString()}</span></div>
            </TabsContent>
            <TabsContent value="manuale" className="space-y-3 mt-4">
              <p className="text-sm text-muted-foreground">Configura manualmente le rate (mock). La tabella editabile verrà collegata alle RPC.</p>
              <div className="border rounded-md p-3 text-sm">Nessuna riga configurata.</div>
            </TabsContent>
          </Tabs>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
          {tab === "auto" ? (
            <Button onClick={saveAuto} disabled={!online}>Salva (Automatico)</Button>
          ) : (
            <Button onClick={() => { toast({ title: "Creato (mock)", description: "Manuale" }); onOpenChange(false); onCreated?.(); }} disabled={!online}>Salva (Manuale)</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
