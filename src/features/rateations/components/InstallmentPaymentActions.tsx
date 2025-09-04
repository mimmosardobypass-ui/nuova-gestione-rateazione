import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { toLocalISO } from "@/utils/date";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { formatEuro } from "@/lib/formatters";
import { markInstallmentPaidOrdinary, cancelInstallmentPayment } from "../api/installments";
import { RavvedimentoModal } from "./RavvedimentoModal";
import { getPaymentDate } from "../lib/installmentState";
import type { InstallmentUI } from "../types";

interface InstallmentPaymentActionsProps {
  rateationId: string;
  installment: InstallmentUI;
  onReload?: () => void;
  onReloadList?: () => void;
  onStatsReload?: () => void;
  disabled?: boolean;
}

export function InstallmentPaymentActions({ 
  rateationId, 
  installment, 
  onReload, 
  onReloadList,
  onStatsReload, 
  disabled = false 
}: InstallmentPaymentActionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [unpaying, setUnpaying] = useState(false);
  const [showRavvedimento, setShowRavvedimento] = useState(false);

  // Use getPaymentDate for consistent payment date retrieval
  const currentPaymentDate = useMemo(() => {
    return getPaymentDate(installment) || toLocalISO(new Date());
  }, [installment]);

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    getPaymentDate(installment) ? new Date(getPaymentDate(installment)!) : new Date()
  );

  const handleMarkPaidOrdinary = async (date: Date) => {
    if (!date || disabled) return;
    
    setSaving(true);
    try {
      const isoDate = toLocalISO(date);
      await markInstallmentPaidOrdinary({
        installmentId: installment.id.toString(),
        paidDate: isoDate
      });
      
      toast({
        title: "Rata pagata",
        description: "Pagamento ordinario registrato"
      });
      
      onReload?.();
      onReloadList?.();
      onStatsReload?.();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSaving(false);
      setIsOpen(false);
    }
  };

  const handleUnmarkPaid = async () => {
    if (disabled) return;
    
    const confirmed = window.confirm("Sei sicuro di voler annullare il pagamento di questa rata?");
    if (!confirmed) return;

    setUnpaying(true);
    try {
      await cancelInstallmentPayment(installment.id);
      
      toast({
        title: "Pagamento annullato",
        description: "La rata è stata rimessa in stato non pagata"
      });
      
      onReload?.();
      onReloadList?.();
      onStatsReload?.();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setUnpaying(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {!installment.is_paid ? (
        <div className="flex items-center gap-2">
          {/* Ordinary Payment - Date Picker */}
          <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[200px] justify-start text-left font-normal",
                  !selectedDate && "text-muted-foreground"
                )}
                disabled={disabled || saving}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? (
                  format(selectedDate, "dd/MM/yyyy", { locale: it })
                ) : (
                  <span>Paga (ordinario)</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => {
                  if (date) {
                    setSelectedDate(date);
                    handleMarkPaidOrdinary(date);
                  }
                }}
                initialFocus
                locale={it}
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
          
          {/* Ravvedimento Payment Button */}
          <Button
            variant="secondary"
            onClick={() => setShowRavvedimento(true)}
            disabled={disabled}
            className="whitespace-nowrap"
          >
            Paga con ravvedimento
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <div className="text-sm">
            <div className="font-medium">
              {installment.payment_mode === 'ravvedimento' ? 'Pagata (Rav.)' : 'Pagata'}
            </div>
            <div className="text-muted-foreground">
              {format(new Date(currentPaymentDate), "dd/MM/yyyy", { locale: it })}
            </div>
            {installment.payment_mode === 'ravvedimento' && (
              <div className="text-xs text-muted-foreground mt-1">
                Quota: {formatEuro(installment.amount)} • 
                Extra: {formatEuro((installment.extra_interest_euro || 0) + (installment.extra_penalty_euro || 0))} • 
                Totale: {formatEuro(installment.amount + (installment.extra_interest_euro || 0) + (installment.extra_penalty_euro || 0))}
              </div>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleUnmarkPaid}
            disabled={disabled || unpaying}
          >
            {unpaying ? "Annullando..." : "Annulla pagamento"}
          </Button>
        </div>
      )}

      {/* New Ravvedimento Modal */}
      <RavvedimentoModal
        open={showRavvedimento}
        installment={{
          id: installment.id.toString(),
          amount: installment.amount,
          dueDate: installment.due_date
        }}
        onSuccess={() => {
          setShowRavvedimento(false);
          onReload?.();
          onReloadList?.();
          onStatsReload?.();
        }}
        onClose={() => setShowRavvedimento(false)}
      />
    </div>
  );
}