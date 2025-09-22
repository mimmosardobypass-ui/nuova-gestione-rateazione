import React, { useState, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { useRateationTypes } from "../hooks/useRateationTypes";
import { fetchSingleRateation, updateRateation, markPagopaInterrupted, getRiamQuaterOptions } from "../api/rateations";
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

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [types, setTypes] = useState<{ id: number; name: string }[]>([]);

  const [numero, setNumero] = useState("");
  const [typeId, setTypeId] = useState<string | undefined>(undefined);
  const [contribuente, setContribuente] = useState("");
  const [totalAmount, setTotalAmount] = useState<string>("0");
  const [startDueDate, setStartDueDate] = useState<string>("");

  // NEW: PagoPA Interruption fields
  const [currentRateation, setCurrentRateation] = useState<any>(null);
  const [isInterrupted, setIsInterrupted] = useState(false);
  const [riamQuaterId, setRiamQuaterId] = useState<string | null>(null);
  const [riamQuaterOptions, setRiamQuaterOptions] = useState<{ id: number; number: string; taxpayer_name: string | null }[]>([]);
  const [interruptionReason, setInterruptionReason] = useState("");

  const rid = rateationId ? Number(rateationId) : null;

  const loadTypes = useCallback(async () => {
    const { data, error } = await supabase.from("rateation_types").select("id, name").order("name", { ascending: true });
    if (error) {
      console.error(error);
      toast({ title: "Errore", description: "Impossibile caricare i tipi.", variant: "destructive" });
      return;
    }
    setTypes((data || []).map((t) => ({ id: Number(t.id), name: String(t.name) })));
  }, []);

  const loadRateation = useCallback(async () => {
    if (!rid) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("rateations")
        .select("id, number, taxpayer_name, total_amount, start_due_date, type_id, status, interrupted_at, interruption_reason, interrupted_by_rateation_id")
        .eq("id", rid)
        .single();
      if (error) throw error;
      
      setCurrentRateation(data);
      setNumero(String(data?.number ?? ""));
      setTypeId(data?.type_id != null ? String(data.type_id) : undefined);
      setContribuente(String(data?.taxpayer_name ?? ""));
      setTotalAmount(String(Number(data?.total_amount ?? 0)));
      setStartDueDate(data?.start_due_date ? String(data.start_due_date) : "");
      
      // NEW: Initialize interruption fields
      const interrupted = data?.status === 'INTERROTTA' && !!data?.interrupted_by_rateation_id;
      setIsInterrupted(interrupted);
      setRiamQuaterId(data?.interrupted_by_rateation_id ? String(data.interrupted_by_rateation_id) : null);
      setInterruptionReason(data?.interruption_reason || "");
    } catch (e: any) {
      console.error(e);
      toast({ title: "Errore", description: "Impossibile caricare la rateazione.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [rid]);

  useEffect(() => {
    if (open) {
      // Load types, rateation and Riam.Quater options in parallel
      Promise.all([loadTypes(), loadRateation(), loadRiamQuaterOptions()]).catch((e) => console.error(e));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rid]);

  const loadRiamQuaterOptions = useCallback(async () => {
    try {
      const options = await getRiamQuaterOptions();
      setRiamQuaterOptions(options);
    } catch (e: any) {
      console.error(e);
      toast({ title: "Errore", description: "Impossibile caricare le opzioni Riam.Quater.", variant: "destructive" });
    }
  }, []);

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
    
    // NEW: Validation for PagoPA interruption
    const selectedType = types.find(t => t.id === Number(typeId));
    const isPagoPA = selectedType?.name === 'PagoPA';
    
    if (isInterrupted) {
      if (!isPagoPA) {
        toast({ title: "Tipo non valido", description: "Solo le rateazioni PagoPA possono essere interrotte.", variant: "destructive" });
        return;
      }
      if (!riamQuaterId) {
        toast({ title: "Seleziona Riam.Quater", description: "È necessario selezionare la Riam.Quater di collegamento.", variant: "destructive" });
        return;
      }
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

      // NEW: Handle PagoPA interruption
      if (isPagoPA && isInterrupted && riamQuaterId) {
        await markPagopaInterrupted(
          String(rid), 
          riamQuaterId, 
          interruptionReason || "Interrotta per Riammissione Quater"
        );
      }

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
  const selectedType = types.find(t => t.id === Number(typeId));
  const isPagoPA = selectedType?.name === 'PagoPA';

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

          {/* NEW: PagoPA Interruption Section */}
          {isPagoPA && (
            <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
              <h4 className="text-sm font-medium">Gestione Interruzione PagoPA</h4>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="interrupted"
                  checked={isInterrupted}
                  onCheckedChange={(checked) => setIsInterrupted(checked === true)}
                  disabled={disabled}
                />
                <Label htmlFor="interrupted" className="text-sm font-normal">
                  Interrotta per Riammissione Quater
                </Label>
              </div>

              {isInterrupted && (
                <div className="space-y-3 ml-6">
                  <div className="space-y-2">
                    <Label>Riam.Quater di collegamento</Label>
                    <Select value={riamQuaterId || ""} onValueChange={(value) => setRiamQuaterId(value || null)} disabled={disabled}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona Riam.Quater" />
                      </SelectTrigger>
                      <SelectContent>
                        {riamQuaterOptions.map((option) => (
                          <SelectItem key={option.id} value={String(option.id)}>
                            {option.number} {option.taxpayer_name ? `- ${option.taxpayer_name}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="reason">Motivo interruzione (opzionale)</Label>
                    <Input
                      id="reason"
                      value={interruptionReason}
                      onChange={(e) => setInterruptionReason(e.target.value)}
                      placeholder="Es. Interrotta per Riammissione Quater"
                      disabled={disabled}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
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
