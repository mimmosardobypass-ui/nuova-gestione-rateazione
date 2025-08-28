import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { rollbackDebtMigration } from '../api/debts';
import { RateationRow } from '../types';
import { supabase } from '@/integrations/supabase/client';

interface RollbackMigrationDialogProps {
  rateation: RateationRow;
  trigger: React.ReactNode;
  onRollbackComplete?: () => void;
}

export const RollbackMigrationDialog: React.FC<RollbackMigrationDialogProps> = ({
  rateation,
  trigger,
  onRollbackComplete
}) => {
  const [open, setOpen] = useState(false);
  const [processing, setProcessing] = useState(false);

  const { toast } = useToast();

  const handleRollback = async () => {
    if (!rateation.migrated_debt_numbers || rateation.migrated_debt_numbers.length === 0) {
      toast({
        title: "Errore",
        description: "Nessuna cartella migrata da ripristinare",
        variant: "destructive"
      });
      return;
    }

    setProcessing(true);
    try {
      // RLS-safe debt lookup via rateation_debts (user must own the rateation)
      const { data, error: fetchError } = await supabase
        .from('rateation_debts')
        .select('debt_id, debt:debts!inner(number)')
        .eq('rateation_id', rateation.id)
        .eq('status', 'migrated_out')
        .in('debts.number', rateation.migrated_debt_numbers);

      if (fetchError) {
        throw new Error(`Errore nel recupero cartelle: ${fetchError.message}`);
      }

      if (!data || data.length === 0) {
        throw new Error('Nessuna cartella trovata da ripristinare');
      }

      const debtIds = data.map(d => d.debt_id);
      
      await rollbackDebtMigration(
        rateation.id, // No parseInt needed - already string
        debtIds
      );

      toast({
        title: "Successo",
        description: `Ripristinate ${rateation.migrated_debt_numbers.length} cartelle`,
        duration: 5000
      });

      setOpen(false);
      onRollbackComplete?.();
      
    } catch (error) {
      console.error('Rollback error:', error);
      const errorMessage = error instanceof Error ? error.message : "Errore durante il ripristino delle cartelle";
      toast({
        title: "Errore",
        description: errorMessage,
        variant: "destructive",
        duration: 8000
      });
    } finally {
      setProcessing(false);
    }
  };

  // Only show for rateations with migrated debts
  if (!rateation.migrated_debt_numbers || rateation.migrated_debt_numbers.length === 0) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-600">
            <AlertTriangle className="h-5 w-5" />
            Conferma Ripristino
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Stai per ripristinare la migrazione delle seguenti cartelle:
          </div>
          
          <div className="p-3 bg-muted rounded-lg">
            <div className="text-sm font-medium">Piano: {rateation.numero}</div>
            <div className="text-sm text-muted-foreground mt-1">
              Cartelle: {rateation.migrated_debt_numbers.join(', ')}
            </div>
          </div>

          <div className="text-sm text-orange-600 font-medium">
            ⚠️ Questa operazione:
          </div>
          <ul className="text-sm text-muted-foreground space-y-1 ml-4">
            <li>• Riporterà le cartelle allo stato "attivo"</li>
            <li>• Rimuoverà i collegamenti dal piano RQ di destinazione</li>
            <li>• Ripristinerà i KPI del piano originale</li>
            <li>• Non può essere annullata facilmente</li>
          </ul>

          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={processing}>
              Annulla
            </Button>
            <Button 
              onClick={handleRollback}
              disabled={processing}
              className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700"
            >
              {processing ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              Ripristina Migrazione
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};