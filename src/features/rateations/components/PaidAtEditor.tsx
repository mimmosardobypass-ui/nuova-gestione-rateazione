import { useMemo, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Pencil, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { toast } from '@/hooks/use-toast';
import { markInstallmentPaidWithDate, unmarkInstallmentPaid } from '../api/installments';
import { cn } from '@/lib/utils';

type Props = {
  rateationId: string;
  seq: number;
  dueDate?: string | null;
  paidAt?: string | null;
  isPaid: boolean;
  lateDays?: number;
  onSaved?: () => void;
  disabled?: boolean;
};

export function PaidAtEditor({
  rateationId, 
  seq, 
  dueDate, 
  paidAt, 
  isPaid, 
  lateDays, 
  onSaved, 
  disabled = false
}: Props) {
  const defaultDate = useMemo(() => (paidAt ? new Date(paidAt) : new Date()), [paidAt]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Date>(defaultDate);

  const due = useMemo(() => (dueDate ? new Date(dueDate) : null), [dueDate]);

  // Calculate late days for display (local calculation for immediate feedback)
  const computedLateDays = useMemo(() => {
    const base = isPaid ? selected : new Date();
    if (!due) return 0;
    const a = new Date(base); a.setHours(0,0,0,0);
    const b = new Date(due); b.setHours(0,0,0,0);
    return Math.max(0, Math.round((+a - +b) / 86400000));
  }, [isPaid, selected, due]);

  const displayLate = lateDays ?? computedLateDays;

  const save = async () => {
    try {
      setSaving(true);
      const ymd = format(selected, 'yyyy-MM-dd');
      await markInstallmentPaidWithDate(rateationId, seq, ymd);
      toast({ 
        title: 'Pagamento registrato', 
        description: `Rata #${seq} pagata il ${format(selected,'dd/MM/yyyy', { locale: it })}` 
      });
      setOpen(false);
      onSaved?.();
    } catch (e: any) {
      toast({ 
        title: 'Errore', 
        description: e?.message || 'Impossibile salvare', 
        variant: 'destructive' 
      });
    } finally { 
      setSaving(false); 
    }
  };

  const unpay = async () => {
    if (!confirm('Confermi di voler annullare il pagamento?')) return;
    try {
      setSaving(true);
      await unmarkInstallmentPaid(rateationId, seq);
      toast({ 
        title: 'Pagamento annullato', 
        description: `Rata #${seq} riportata a non pagata` 
      });
      setOpen(false);
      onSaved?.();
    } catch (e: any) {
      toast({ 
        title: 'Errore', 
        description: e?.message || 'Impossibile annullare', 
        variant: 'destructive' 
      });
    } finally { 
      setSaving(false); 
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className="text-sm">
        <span className="text-foreground">
          {paidAt ? format(new Date(paidAt), 'dd/MM/yyyy', { locale: it }) : '—'}
        </span>
        {displayLate > 0 && (
          <div className="text-xs text-destructive">
            {displayLate} giorni di ritardo
          </div>
        )}
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon" 
            disabled={disabled || saving} 
            title="Modifica data pagamento"
            className="h-8 w-8"
          >
            <Pencil className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3" align="start">
          <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarIcon className="h-4 w-4" />
            <div>
              {selected ? format(selected,'dd/MM/yyyy', { locale: it }) : 'Seleziona data'}
              {due && (
                <div className="text-xs">
                  {computedLateDays > 0 ? `${computedLateDays} giorni di ritardo` : 'In tempo'}
                </div>
              )}
            </div>
          </div>
          <Calendar
            mode="single"
            selected={selected}
            onSelect={(d) => d && setSelected(d)}
            initialFocus
            locale={it}
            className={cn('pointer-events-auto')}
          />
          <div className="mt-3 flex gap-2">
            <Button 
              onClick={save} 
              disabled={saving}
              size="sm"
            >
              {saving ? 'Salvataggio…' : (isPaid ? 'Aggiorna' : 'Salva')}
            </Button>
            {isPaid && (
              <Button 
                variant="outline" 
                onClick={unpay} 
                disabled={saving}
                size="sm"
              >
                Annulla
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}