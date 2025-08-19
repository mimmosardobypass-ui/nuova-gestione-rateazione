import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { markInstallmentPaidOrdinaryFixed as markInstallmentPaidOrdinary, cancelInstallmentPayment } from "../api/installments";
import { RavvedimentoDialog } from "./RavvedimentoDialog";
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
  const [showRavvedimento, setShowRavvedimento] = useState(false);

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

    const dateStr = selectedDate.toISOString().slice(0, 10);
    
    try {
      setSaving(true);
      // Always use ordinary payment - no automatic ravvedimento calculation
      await markInstallmentPaidOrdinary(rateationId, installment.seq, dateStr);
      
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
    if (!confirm("Sei sicuro di voler annullare il pagamento di questa rata?")) return;
    
    setUnpaying(true);
    try {
      await cancelInstallmentPayment(installment.id);
      toast({
        title: "Successo",
        description: "Pagamento annullato"
      });
      onReload();
      onStatsReload?.();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Errore nell'annullamento",
        variant: "destructive"
      });
    } finally {
      setUnpaying(false);
    }
  };

  // Check if installment is late and unpaid for explicit ravvedimento button
  const isLate = !installment.is_paid && new Date() > new Date(installment.due_date);
  const [dateForRav, setDateForRav] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [showExplicitRav, setShowExplicitRav] = useState(false);

  // Check if paid installment is late without ravvedimento
  const isPaidLateWithoutRavvedimento = installment.is_paid && 
    installment.late_days && installment.late_days > 0 && 
    !installment.penalty_amount_cents && 
    !installment.interest_amount_cents;

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

      {isLate && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            className="px-2 py-1 text-sm border rounded"
            value={dateForRav}
            onChange={(e) => setDateForRav(e.target.value)}
          />
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowExplicitRav(true)}
            disabled={disabled}
          >
            Paga con ravvedimento
          </Button>
        </div>
      )}

      {isPaidLateWithoutRavvedimento && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowExplicitRav(true)}
          disabled={disabled}
          className="text-purple-600 hover:text-purple-700 border-purple-600"
        >
          Calcola ravvedimento
        </Button>
      )}

      <RavvedimentoDialog
        open={showRavvedimento}
        onOpenChange={setShowRavvedimento}
        installment={installment}
        paidAt={selectedDate?.toISOString().slice(0, 10) || ''}
        onConfirm={() => {
          onReload();
          onStatsReload?.();
        }}
      />

      <RavvedimentoDialog
        open={showExplicitRav}
        onOpenChange={setShowExplicitRav}
        installment={installment}
        paidAt={dateForRav}
        onConfirm={() => {
          onReload();
          onStatsReload?.();
        }}
      />
    </div>
  );
}