import * as React from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { formatEuro } from "@/lib/formatters";
import { markInstallmentPaidRavvedimento } from "../api/installments";

const schema = z.object({
  paidDate: z.string().min(10, "Data obbligatoria"),
  totalPaid: z.coerce.number().positive("Importo > 0"),
  interest: z.coerce.number().nonnegative().optional(),
  penalty: z.coerce.number().nonnegative().optional(),
});

type Props = {
  open: boolean;
  onClose: () => void;
  installment: { id: string; amount: number; dueDate: string };
  onSuccess?: () => void;
};

export function RavvedimentoModal({ open, onClose, installment, onSuccess }: Props) {
  const [form, setForm] = React.useState({ 
    paidDate: "", 
    totalPaid: installment.amount, 
    interest: 0, 
    penalty: 0 
  });
  const [saving, setSaving] = React.useState(false);

  const extra = Math.max((form.totalPaid ?? 0) - installment.amount, 0);

  const submit = async () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast({ 
        title: "Errore validazione", 
        description: parsed.error.errors.map(e => e.message).join(", "),
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    try {
      await markInstallmentPaidRavvedimento({
        installmentId: installment.id,
        paidDate: parsed.data.paidDate,
        totalPaid: parsed.data.totalPaid,
        interest: parsed.data.interest,
        penalty: parsed.data.penalty,
      });
      
      toast({ 
        title: "Ravvedimento applicato", 
        description: `Rata pagata con extra di ${formatEuro(extra)}`
      });
      
      onClose();
      onSuccess?.();
    } catch (error: any) {
      toast({ 
        title: "Errore", 
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !saving && !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Paga con ravvedimento</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Importo rata (quota capitale): <span className="font-medium">{formatEuro(installment.amount)}</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="paidDate">Data pagamento</Label>
              <Input 
                id="paidDate"
                type="date" 
                value={form.paidDate} 
                onChange={e => setForm(s => ({ ...s, paidDate: e.target.value }))}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="totalPaid">Totale versato</Label>
              <Input 
                id="totalPaid"
                type="number" 
                step="0.01" 
                value={form.totalPaid}
                onChange={e => setForm(s => ({ ...s, totalPaid: Number(e.target.value) }))}
                className="w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="interest">Interessi (facoltativo)</Label>
              <Input 
                id="interest"
                type="number" 
                step="0.01" 
                value={form.interest}
                onChange={e => setForm(s => ({ ...s, interest: Number(e.target.value) }))}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="penalty">Sanzione (facoltativo)</Label>
              <Input 
                id="penalty"
                type="number" 
                step="0.01" 
                value={form.penalty}
                onChange={e => setForm(s => ({ ...s, penalty: Number(e.target.value) }))}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="rounded-md bg-muted p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span>Quota capitale:</span>
              <span className="font-medium">{formatEuro(installment.amount)}</span>
            </div>
            <div className="flex justify-between">
              <span>Extra ravvedimento:</span>
              <span className="font-medium">{formatEuro(extra)}</span>
            </div>
            <div className="flex justify-between border-t pt-1">
              <span className="font-medium">Totale versato:</span>
              <span className="font-bold">{formatEuro(form.totalPaid || 0)}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Annulla
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Salvando..." : "Conferma pagamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}