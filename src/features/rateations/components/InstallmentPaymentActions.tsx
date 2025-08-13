import React, { useState, useMemo } from "react";
import { Calendar, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { markInstallmentPaid, unmarkInstallmentPaid } from "../api/installments";
import type { InstallmentUI } from "../types";

interface InstallmentPaymentActionsProps {
  rateationId: string;
  installment: InstallmentUI;
  onReload: () => void;
  onStatsReload?: () => void;
  allowUnpay?: boolean;
}

export function InstallmentPaymentActions({
  rateationId,
  installment,
  onReload,
  onStatsReload,
  allowUnpay = true,
}: InstallmentPaymentActionsProps) {
  const todayISO = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
  }, []);

  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    if (installment.paid_at) {
      return new Date(installment.paid_at);
    }
    return new Date();
  });
  
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [unpaying, setUnpaying] = useState(false);

  const handleMarkPaid = async () => {
    try {
      setSaving(true);
      const paidAtISO = selectedDate.toISOString().slice(0, 10);
      await markInstallmentPaid(rateationId, installment.seq, paidAtISO);
      
      toast({
        title: installment.is_paid ? "Pagamento aggiornato" : "Pagamento registrato",
        description: `Rata #${installment.seq} ${installment.is_paid ? "aggiornata" : "pagata"} in data ${format(selectedDate, "dd/MM/yyyy", { locale: it })}.`,
      });
      
      onReload();
      onStatsReload?.();
      setOpen(false);
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error?.message || "Impossibile salvare la data di pagamento.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleUnmarkPaid = async () => {
    if (!allowUnpay || !installment.is_paid) return;
    
    if (!confirm("Confermi di voler annullare il pagamento di questa rata?")) return;

    try {
      setUnpaying(true);
      await unmarkInstallmentPaid(rateationId, installment.seq);
      
      toast({
        title: "Pagamento annullato",
        description: `Rata #${installment.seq} riportata a non pagata.`,
      });
      
      // Reset date to today for next payment
      setSelectedDate(new Date());
      onReload();
      onStatsReload?.();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error?.message || "Impossibile annullare il pagamento.",
        variant: "destructive",
      });
    } finally {
      setUnpaying(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={installment.is_paid ? "secondary" : "default"}
            size="sm"
            className={cn(
              "justify-start text-left font-normal",
              !selectedDate && "text-muted-foreground"
            )}
            title={installment.is_paid ? 
              "Modifica data di pagamento (puoi anche retrodatare)" : 
              "Seleziona data di pagamento (puoi anche retrodatare)"
            }
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {installment.is_paid ? 
              `Aggiorna (${format(selectedDate, "dd/MM/yyyy", { locale: it })})` :
              `Paga (${format(selectedDate, "dd/MM/yyyy", { locale: it })})`
            }
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-3">
            <div className="mb-3">
              <p className="text-sm font-medium">
                {installment.is_paid ? "Modifica data pagamento" : "Seleziona data pagamento"}
              </p>
              <p className="text-xs text-muted-foreground">
                Puoi inserire una data passata per registrare il pagamento con retrodatazione
              </p>
            </div>
            <CalendarComponent
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
              locale={it}
            />
            <div className="flex gap-2 mt-3">
              <Button
                onClick={handleMarkPaid}
                disabled={saving}
                size="sm"
                className="flex-1"
              >
                {saving ? "Salvataggio..." : installment.is_paid ? "Aggiorna" : "Conferma pagamento"}
              </Button>
              <Button
                onClick={() => setOpen(false)}
                variant="outline"
                size="sm"
              >
                Annulla
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {allowUnpay && installment.is_paid && (
        <Button
          onClick={handleUnmarkPaid}
          disabled={unpaying}
          variant="outline"
          size="sm"
          className="text-destructive hover:text-destructive"
          title="Annulla pagamento"
        >
          {unpaying ? "Annullamento..." : "Annulla pagamento"}
        </Button>
      )}
    </div>
  );
}