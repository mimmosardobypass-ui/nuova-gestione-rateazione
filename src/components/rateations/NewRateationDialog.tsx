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

  const total = numRate * amountPerRate;

  const saveAuto = () => {
    toast({ title: "Rateazione creata (mock)", description: `Totale € ${total.toLocaleString()}` });
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
                    <SelectItem value="f24">F24</SelectItem>
                    <SelectItem value="pagopa">PagoPA</SelectItem>
                    <SelectItem value="quater">Quater</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" aria-label="Nuovo tipo">
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
          {tab === "auto" ? (
            <Button onClick={saveAuto}>Salva (Automatico)</Button>
          ) : (
            <Button onClick={() => { toast({ title: "Creato (mock)", description: "Manuale" }); onOpenChange(false); onCreated?.(); }}>Salva (Manuale)</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
