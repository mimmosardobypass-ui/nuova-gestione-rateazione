import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { toIntId } from '@/lib/utils/ids';

interface OrphanedMigration {
  debt_id: string;
  issue_type: 'orphaned_migrated_in' | 'orphaned_migrated_out';
  details: {
    rateation_id: number;
    target_rateation_id?: number;
    migrated_at?: string;
  };
}

export const useOrphanedMigrations = () => {
  const [orphaned, setOrphaned] = useState<OrphanedMigration[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const detectOrphanedMigrations = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('fn_detect_orphaned_migrations');
      
      if (error) {
        console.error('Error detecting orphaned migrations:', error);
        throw error;
      }

      setOrphaned((data || []).map(item => ({
        debt_id: item.debt_id,
        issue_type: item.issue_type as 'orphaned_migrated_in' | 'orphaned_migrated_out',
        details: item.details as any
      })));

      if (data && data.length > 0) {
        toast({
          title: "Migrazioni Orfane Rilevate",
          description: `Trovate ${data.length} migrazioni inconsistenti che richiedono attenzione`,
          variant: "destructive",
          duration: 8000
        });
      } else {
        toast({
          title: "Nessuna Migrazione Orfana",
          description: "Tutte le migrazioni sono coerenti",
        });
      }
    } catch (error) {
      console.error('Error detecting orphaned migrations:', error);
      toast({
        title: "Errore",
        description: "Errore durante la ricerca di migrazioni orfane",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const repairOrphanedMigration = async (orphan: OrphanedMigration) => {
    try {
      if (orphan.issue_type === 'orphaned_migrated_in') {
        // Remove orphaned migrated_in record
        const { error } = await supabase
          .from('rateation_debts')
          .delete()
          .eq('debt_id', orphan.debt_id)
          .eq('rateation_id', toIntId(orphan.details.rateation_id, 'rateationId'))
          .eq('status', 'migrated_in');

        if (error) throw error;

        toast({
          title: "Riparazione Completata",
          description: "Collegamento orfano migrated_in rimosso",
        });
      } else if (orphan.issue_type === 'orphaned_migrated_out') {
        // Revert orphaned migrated_out back to active
        const { error } = await supabase
          .from('rateation_debts')
          .update({ 
            status: 'active',
            target_rateation_id: null,
            migrated_at: null,
            note: null
          })
          .eq('debt_id', orphan.debt_id)
          .eq('rateation_id', toIntId(orphan.details.rateation_id, 'rateationId'))
          .eq('status', 'migrated_out');

        if (error) throw error;

        toast({
          title: "Riparazione Completata", 
          description: "Cartella ripristinata allo stato attivo",
        });
      }

      // Re-detect to refresh the list
      await detectOrphanedMigrations();
    } catch (error) {
      console.error('Error repairing orphaned migration:', error);
      toast({
        title: "Errore",
        description: "Errore durante la riparazione della migrazione orfana",
        variant: "destructive"
      });
    }
  };

  return {
    orphaned,
    loading,
    detectOrphanedMigrations,
    repairOrphanedMigration
  };
};