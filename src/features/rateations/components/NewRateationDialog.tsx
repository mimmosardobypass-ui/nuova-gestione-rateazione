import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { useOnline } from "@/hooks/use-online";
import { Plus } from "lucide-react";
import { useRateationTypes } from "../hooks/useRateationTypes";
import { createRateationAuto, createRateationManual } from "../api/rateations";
import type { ManualRow } from "../types";

interface NewRateationDialogProps {
  onCreated?: () => void;
  initialOpen?: boolean;
}

export function NewRateationDialog({ onCreated, initialOpen = false }: NewRateationDialogProps) {
  const [open, setOpen] = React.useState(initialOpen);
  const [tab, setTab] = React.useState<"auto" | "manual">("auto");
  const online = useOnline();
  const { types, loadTypes, addNewType } = useRateationTypes();

  // LOVABLE:START formState
  // Auto rateation state
  const [numero, setNumero] = React.useState("");
  const [tipo, setTipo] = React.useState<string | undefined>(undefined);
  const [contribuente, setContribuente] = React.useState("");
  const [numRate, setNumRate] = React.useState<number | undefined>(undefined);
  const [amountPerRate, setAmountPerRate] = React.useState<number | undefined>(undefined);
  const [firstDue, setFirstDue] = React.useState("");

  // Manual rateation state
  const [manualCount, setManualCount] = React.useState<number | undefined>(undefined);
  const [manualTotal, setManualTotal] = React.useState<string>("");
  const [manualRows, setManualRows] = React.useState<ManualRow[]>([]);

  // Saving states
  const [savingAuto, setSavingAuto] = React.useState(false);
  const [savingManual, setSavingManual] = React.useState(false);
  // LOVABLE:END formState

  // LOVABLE:START resetForm
  const resetForm = () => {
    setNumero("");
    setTipo(undefined);
    setContribuente("");
    setNumRate(undefined);
    setAmountPerRate(undefined);
    setFirstDue("");
    setManualCount(undefined);
    setManualTotal("");
    setManualRows([]);
    setTab("auto");
  };
  // LOVABLE:END resetForm

  React.useEffect(() => {
    setOpen(initialOpen);
  }, [initialOpen]);

  React.useEffect(() => {
    if (open) {
      resetForm();
      loadTypes();
    }
  }, [open, loadTypes]);

  // LOVABLE:START manualRows
  React.useEffect(() => {
    if (!manualCount || manualCount <= 0) {
      setManualRows([]);
      return;
    }
    const today = new Date();
    const rows = Array.from({ length: manualCount }, (_, i) => {
      const d = new Date(today.getFullYear(), today.getMonth() + i, today.getDate());
      return { amount: "", due: d.toISOString().slice(0, 10) };
    });
    setManualRows(rows);
  }, [manualCount]);
  // LOVABLE:END manualRows

  const distributeFromTotal = () => {
    const total = Number((manualTotal || "0").replace(",", "."));
    if (!manualRows.length || !Number.isFinite(total)) return;
    const base = Math.floor((total / manualRows.length) * 100) / 100;
    let acc = 0;
    const rows = manualRows.map((r, idx) => {
      const amt = (idx < manualRows.length - 1) ? base : Math.round((total - acc) * 100) / 100;
      acc = Math.round((acc + amt) * 100) / 100;
      return { ...r, amount: String(amt) };
    });
    setManualRows(rows);
  };

  // LOVABLE:START saveAuto
  const saveAuto = async () => {
    if (!online) return toast({ title: "Offline", description: "Impossibile salvare.", variant: "destructive" });
    if (!tipo) return toast({ title: "Tipo richiesto", description: "Seleziona un tipo prima di salvare.", variant: "destructive" });
    if (!numRate) return toast({ title: "Numero rate richiesto", description: "Inserisci il numero di rate.", variant: "destructive" });
    if (!amountPerRate) return toast({ title: "Importo richiesto", description: "Inserisci l'importo per rata.", variant: "destructive" });
    if (!firstDue) return toast({ title: "Data richiesta", description: "Inserisci la prima scadenza.", variant: "destructive" });
    if (savingAuto) return toast({ title: "Operazione in corso", description: "Attendi il completamento", variant: "destructive" });

    const p_number = numero?.trim() || `R-${new Date().toISOString().slice(0, 10)}-${Math.floor(Math.random() * 1000)}`;

    setSavingAuto(true);
    try {
      const data = await createRateationAuto({
        p_number,
        p_type_id: Number(tipo),
        p_taxpayer_name: contribuente || null,
        p_start_due_date: firstDue,
        p_frequency: "monthly",
        p_num_installments: numRate,
        p_amount_per_installment: amountPerRate,
      });

      toast({ title: "Rateazione creata", description: `ID ${data}` });
      setOpen(false);
      onCreated?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Errore sconosciuto";
      toast({ title: "Errore", description: message, variant: "destructive" });
    } finally {
      setSavingAuto(false);
    }
  };
  // LOVABLE:END saveAuto

  // LOVABLE:START saveManual
  const saveManual = async () => {
    if (!online) return toast({ title: "Offline", description: "Impossibile salvare.", variant: "destructive" });
    if (!tipo) return toast({ title: "Tipo richiesto", description: "Seleziona un tipo prima di salvare.", variant: "destructive" });
    if (savingManual) return toast({ title: "Operazione in corso", description: "Attendi il completamento", variant: "destructive" });
    
    if (!manualRows.length) {
      return toast({ title: "Rate richieste", description: "Aggiungi almeno una rata.", variant: "destructive" });
    }
    
    const invalidRows = manualRows.filter(r => !r.due || !r.amount || Number.isNaN(Number(r.amount)));
    if (invalidRows.length > 0) {
      return toast({ title: "Dati non validi", description: "Controlla che tutte le rate abbiano importo e data validi.", variant: "destructive" });
    }

    const payload = manualRows.map((r, idx) => ({ 
      seq: idx + 1,
      amount: Number(String(r.amount).replace(",", ".")), 
      due_date: r.due 
    }));
    const p_number = numero?.trim() || `R-${new Date().toISOString().slice(0, 10)}-${Math.floor(Math.random() * 1000)}`;

    setSavingManual(true);
    try {
      const data = await createRateationManual({
        p_number,
        p_type_id: Number(tipo),
        p_taxpayer_name: contribuente || null,
        p_installments_json: payload,
      });

      toast({ title: "Rateazione creata", description: `ID ${data}` });
      setOpen(false);
      onCreated?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Errore sconosciuto";
      toast({ title: "Errore", description: message, variant: "destructive" });
    } finally {
      setSavingManual(false);
    }
  };
  // LOVABLE:END saveManual

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Nuova rateazione
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuova Rateazione</DialogTitle>
        </DialogHeader>

        <div className="px-5 pt-5">
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList>
              <TabsTrigger value="auto">Automatico</TabsTrigger>
              <TabsTrigger value="manual">Manuale</TabsTrigger>
            </TabsList>

            {/* LOVABLE:START tabContent */}
            <TabsContent value="auto" className="mt-6">
              {/* LOVABLE:START formFields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <Label className="text-xs">Numero</Label>
                  <Input 
                    className="h-9" 
                    value={numero} 
                    onChange={(e) => setNumero(e.target.value)} 
                    placeholder="Lascia vuoto per generazione automatica"
                  />
                </div>
                <div>
                  <Label className="text-xs">Tipo</Label>
                  <div className="flex gap-2">
                    <Select value={tipo} onValueChange={setTipo}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Seleziona tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        {types.length === 0 ? (
                          <div className="px-3 py-2 text-sm text-muted-foreground">
                            Nessun tipo disponibile
                          </div>
                        ) : (
                          types.map((t) => (
                            <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                     <Button className="h-9" variant="outline" onClick={() => addNewType(setTipo)}>+</Button>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs">Contribuente</Label>
                  <Input 
                    className="h-9" 
                    value={contribuente} 
                    onChange={(e) => setContribuente(e.target.value)} 
                    placeholder="Nome del contribuente (opzionale)"
                  />
                </div>
                <div>
                  <Label className="text-xs">Numero rate</Label>
                  <Input 
                    className="h-9" 
                    type="number" 
                    min={1} 
                    value={numRate ?? ""} 
                    onChange={(e) => setNumRate(e.target.value ? parseInt(e.target.value, 10) : undefined)} 
                    placeholder="Es. 6"
                  />
                </div>
                <div>
                  <Label className="text-xs">Importo per rata</Label>
                  <Input 
                    className="h-9" 
                    type="number" 
                    step="0.01" 
                    min={0} 
                    value={amountPerRate ?? ""} 
                    onChange={(e) => setAmountPerRate(e.target.value ? parseFloat(e.target.value) : undefined)} 
                    placeholder="Es. 400"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs">Prima scadenza</Label>
                  <Input 
                    className="h-9" 
                    type="date" 
                    value={firstDue || ""} 
                    onChange={(e) => setFirstDue(e.target.value)} 
                  />
                </div>
              </div>
              
              {/* LOVABLE:START calculatedTotal */}
              {numRate != null && amountPerRate != null ? (
                <div className="text-sm text-muted-foreground mb-4">
                  Totale calcolato: <b>{(numRate * amountPerRate).toLocaleString("it-IT", { style: "currency", currency: "EUR" })}</b>
                </div>
              ) : null}
              {/* LOVABLE:END calculatedTotal */}
              {/* LOVABLE:END formFields */}
            </TabsContent>

            <TabsContent value="manual" className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <Label className="text-xs">Numero</Label>
                  <Input 
                    className="h-9" 
                    value={numero} 
                    onChange={(e) => setNumero(e.target.value)} 
                    placeholder="Lascia vuoto per generazione automatica"
                  />
                </div>
                <div>
                  <Label className="text-xs">Tipo</Label>
                  <div className="flex gap-2">
                    <Select value={tipo} onValueChange={setTipo}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Seleziona tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        {types.length === 0 ? (
                          <div className="px-3 py-2 text-sm text-muted-foreground">
                            Nessun tipo disponibile
                          </div>
                        ) : (
                          types.map((t) => (
                            <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <Button className="h-9" variant="outline" onClick={() => addNewType(setTipo)}>+</Button>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs">Contribuente</Label>
                  <Input 
                    className="h-9" 
                    value={contribuente} 
                    onChange={(e) => setContribuente(e.target.value)} 
                    placeholder="Nome del contribuente (opzionale)"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                <div>
                  <Label className="text-xs">Numero rate</Label>
                  <Input 
                    className="h-9" 
                    type="number" 
                    min={1} 
                    value={manualCount ?? ""} 
                    onChange={(e) => setManualCount(e.target.value ? parseInt(e.target.value, 10) : undefined)} 
                    placeholder="Numero rate"
                  />
                </div>
                <div>
                  <Label className="text-xs">Totale (opz.)</Label>
                  <div className="flex gap-2">
                    <Input 
                      className="h-9" 
                      type="number" 
                      step="0.01" 
                      min={0}
                      value={manualTotal} 
                      onChange={(e) => setManualTotal(e.target.value)} 
                      placeholder="Totale (opz.)"
                    />
                    <Button type="button" className="h-9" variant="outline" onClick={distributeFromTotal}>
                      Riparti dal totale
                    </Button>
                  </div>
                </div>
              </div>

              <div className="mt-3 border rounded">
                {manualRows.map((row, i) => (
                  <div key={i} className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 border-b last:border-b-0">
                    <div className="md:col-span-2">
                      <Label className="text-xs">Importo rata #{i+1}</Label>
                      <Input className="h-9" type="number" step="0.01" min={0}
                             value={row.amount}
                             onChange={(e) => {
                               const v = e.target.value;
                               setManualRows(prev => prev.map((r, idx) => idx===i ? { ...r, amount: v } : r));
                             }} />
                    </div>
                    <div>
                      <Label className="text-xs">Scadenza</Label>
                      <Input className="h-9" type="date" value={row.due}
                             onChange={(e) => {
                               const v = e.target.value;
                               setManualRows(prev => prev.map((r, idx) => idx===i ? { ...r, due: v } : r));
                             }} />
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
            {/* LOVABLE:END tabContent */}
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Annulla
          </Button>
          {tab === "auto" ? (
            <Button onClick={saveAuto} disabled={!online || savingAuto}>
              {savingAuto ? "Salvando..." : "Salva (Automatico)"}
            </Button>
          ) : (
            <Button onClick={saveManual} disabled={!online || savingManual}>
              {savingManual ? "Salvando..." : "Salva (Manuale)"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}