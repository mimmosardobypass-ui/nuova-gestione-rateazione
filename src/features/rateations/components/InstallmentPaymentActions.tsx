import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { markInstallmentPaidWithDate, unmarkInstallmentPaid } from "../api/installments";
import type { InstallmentUI } from "../types";

interface InstallmentPaymentActionsProps {
  rateationId: string;
  installment: InstallmentUI;
  onReload: () => void;
  onStatsReload?: () => void;
  disabled?: boolean;
}

export function InstallmentPaymentActions({
  rateationId,
  installment,
  onReload,
  onStatsReload,
  disabled = false,
}: InstallmentPaymentActionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [unpaying, setUnpaying] = useState(false);

  // Default date: if already paid use paid_at, otherwise today
  const todayDate = useMemo(() => new Date(), []);
  const currentPaymentDate = useMemo(() => {
    if (installment.paid_at) {
      return new Date(installment.paid_at);
    }
    return todayDate;
  }, [installment.paid_at, todayDate]);

  const [selectedDate, setSelectedDate] = useState<Date>(currentPaymentDate);

  const handleMarkPaid = async () => {
    if (!selectedDate) return;

    try {
      setSaving(true);
      const dateStr = selectedDate.toISOString().slice(0, 10);
      await markInstallmentPaidWithDate(rateationId, installment.seq, dateStr);
      
      toast({
        title: installment.is_paid ? "Pagamento aggiornato" : "Pagamento registrato",
        description: `Rata #${installment.seq} ${installment.is_paid ? "aggiornata" : "pagata"} in data ${format(selectedDate, "dd/MM/yyyy")}.`,
      });
      
      setIsOpen(false);
      onReload();
      onStatsReload?.();
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
    if (!confirm("Confermi di voler annullare il pagamento di questa rata?")) return;

    try {
      setUnpaying(true);
      await unmarkInstallmentPaid(rateationId, installment.seq);
      
      toast({
        title: "Pagamento annullato",
        description: `Rata #${installment.seq} riportata a non pagata.`,
      });
      
      // Reset date to today for next payment
      setSelectedDate(todayDate);
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
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={disabled || saving || unpaying}
            className={cn(
              "justify-start text-left font-normal min-w-[120px]",
              !selectedDate && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {selectedDate ? format(selectedDate, "dd/MM/yyyy") : "Seleziona data"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => date && setSelectedDate(date)}
            initialFocus
            locale={it}
            className={cn("p-3 pointer-events-auto")}
          />
          <div className="p-3 pt-0 border-t">
            <Button 
              onClick={handleMarkPaid} 
              disabled={saving || !selectedDate}
              className="w-full"
              size="sm"
            >
              {saving ? "Salvataggio..." : installment.is_paid ? "Aggiorna data" : "Segna pagata"}
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {installment.is_paid && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleUnmarkPaid}
          disabled={disabled || saving || unpaying}
          className="text-destructive hover:text-destructive"
        >
          {unpaying ? "Annullando..." : "Annulla"}
        </Button>
      )}
    </div>
  );
}