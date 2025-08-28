import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface MigrationInconsistency {
  rateation_id: string;
  issue_type: 'missing_debts' | 'orphaned_migrated_in' | 'status_mismatch';
  details: {
    expected_count?: number;
    actual_count?: number;
    missing_debt_ids?: string[];
    orphaned_records?: string[];
  };
}

interface MigrationHealth {
  total_pagopa_rateations: number;
  partially_migrated: number;
  fully_migrated: number;
  inconsistencies: MigrationInconsistency[];
  last_check: Date;
}

export const useMigrationMonitoring = () => {
  const [health, setHealth] = useState<MigrationHealth | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const checkMigrationHealth = async (): Promise<MigrationHealth> => {
    try {
      setLoading(true);

      // Get basic stats
      const { data: stats, error: statsError } = await supabase
        .from('v_rateations_with_kpis')
        .select('id, is_pagopa, rq_migration_status, debts_total, debts_migrated')
        .eq('is_pagopa', true);

      if (statsError) throw statsError;

      const total_pagopa_rateations = stats?.length || 0;
      const partially_migrated = stats?.filter(r => r.rq_migration_status === 'partial').length || 0;
      const fully_migrated = stats?.filter(r => r.rq_migration_status === 'full').length || 0;

      // Check for inconsistencies
      const inconsistencies: MigrationInconsistency[] = [];

      for (const rateation of stats || []) {
        // Check if migrated debts actually exist
        if (rateation.debts_migrated > 0) {
          const { data: migratedDebts, error: debtError } = await supabase
            .from('rateation_debts')
            .select('debt_id, status')
            .eq('rateation_id', rateation.id)
            .eq('status', 'migrated_out');

          if (debtError) {
            console.warn(`Error checking debts for rateation ${rateation.id}:`, debtError);
            continue;
          }

          const actualMigrated = migratedDebts?.length || 0;
          if (actualMigrated !== rateation.debts_migrated) {
            inconsistencies.push({
              rateation_id: rateation.id.toString(),
              issue_type: 'status_mismatch',
              details: {
                expected_count: rateation.debts_migrated,
                actual_count: actualMigrated
              }
            });
          }
        }
      }

      return {
        total_pagopa_rateations,
        partially_migrated,
        fully_migrated,
        inconsistencies,
        last_check: new Date()
      };

    } catch (error) {
      console.error('Migration health check failed:', error);
      toast({
        title: "Errore nel controllo migrazione",
        description: error instanceof Error ? error.message : "Errore sconosciuto",
        variant: "destructive"
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const runHealthCheck = async () => {
    try {
      const healthData = await checkMigrationHealth();
      setHealth(healthData);
      
      if (healthData.inconsistencies.length > 0) {
        toast({
          title: "⚠️ Inconsistenze rilevate",
          description: `Trovate ${healthData.inconsistencies.length} inconsistenze nelle migrazioni`,
          variant: "destructive",
          duration: 8000
        });
      } else {
        toast({
          title: "✅ Sistema sano",
          description: "Nessuna inconsistenza rilevata nelle migrazioni",
          duration: 3000
        });
      }
    } catch (error) {
      // Error already handled in checkMigrationHealth
    }
  };

  const repairInconsistency = async (inconsistency: MigrationInconsistency) => {
    try {
      setLoading(true);
      
      if (inconsistency.issue_type === 'status_mismatch') {
        // Force recalculation of migration status
        const { error } = await supabase.rpc('fn_realign_rateation_totals', {
          p_rateation_id: parseInt(inconsistency.rateation_id)
        });
        
        if (error) throw error;
        
        toast({
          title: "Inconsistenza riparata",
          description: `Ricalcolato stato migrazione per piano ${inconsistency.rateation_id}`,
          duration: 3000
        });
        
        // Refresh health check
        await runHealthCheck();
      }
    } catch (error) {
      toast({
        title: "Errore nella riparazione",
        description: error instanceof Error ? error.message : "Errore sconosciuto",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    health,
    loading,
    runHealthCheck,
    repairInconsistency
  };
};

export type { MigrationHealth, MigrationInconsistency };