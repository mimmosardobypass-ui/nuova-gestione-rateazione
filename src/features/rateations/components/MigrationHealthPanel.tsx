import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  RefreshCw,
  Wrench,
  Database
} from 'lucide-react';
import { useMigrationMonitoring, MigrationInconsistency } from '../hooks/useMigrationMonitoring';
import { formatEuro } from '@/lib/formatters';

interface MigrationHealthPanelProps {
  className?: string;
}

const getInconsistencyIcon = (type: MigrationInconsistency['issue_type']) => {
  switch (type) {
    case 'missing_debts':
      return <Database className="h-4 w-4" />;
    case 'orphaned_migrated_in':
      return <AlertTriangle className="h-4 w-4" />;
    case 'status_mismatch':
      return <Wrench className="h-4 w-4" />;
    default:
      return <AlertTriangle className="h-4 w-4" />;
  }
};

const getInconsistencyTitle = (type: MigrationInconsistency['issue_type']) => {
  switch (type) {
    case 'missing_debts':
      return 'Cartelle mancanti';
    case 'orphaned_migrated_in':
      return 'Record orfani';
    case 'status_mismatch':
      return 'Conteggio errato';
    default:
      return 'Inconsistenza';
  }
};

export const MigrationHealthPanel: React.FC<MigrationHealthPanelProps> = ({ className }) => {
  const { health, loading, runHealthCheck, repairInconsistency } = useMigrationMonitoring();

  React.useEffect(() => {
    // Auto-run health check on mount
    runHealthCheck();
  }, []);

  const hasIssues = health?.inconsistencies.length > 0;
  const healthStatus = hasIssues ? 'warning' : 'healthy';

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className={`h-5 w-5 ${healthStatus === 'healthy' ? 'text-green-600' : 'text-orange-600'}`} />
          Sistema Migrazioni
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {healthStatus === 'healthy' ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-orange-600" />
            )}
            <span className="text-sm font-medium">
              {healthStatus === 'healthy' ? 'Sistema Sano' : 'Inconsistenze Rilevate'}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={runHealthCheck}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Verifica
          </Button>
        </div>

        {health && (
          <>
            <Separator />
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-primary">
                  {health.total_pagopa_rateations}
                </div>
                <div className="text-xs text-muted-foreground">Piani PagoPA</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-600">
                  {health.partially_migrated}
                </div>
                <div className="text-xs text-muted-foreground">Parziali</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {health.fully_migrated}
                </div>
                <div className="text-xs text-muted-foreground">Complete</div>
              </div>
            </div>

            {health.inconsistencies.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-destructive">
                    Inconsistenze ({health.inconsistencies.length})
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {health.inconsistencies.map((inconsistency, index) => (
                      <Alert key={index} variant="destructive" className="py-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getInconsistencyIcon(inconsistency.issue_type)}
                            <div>
                              <div className="text-sm font-medium">
                                {getInconsistencyTitle(inconsistency.issue_type)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Piano: {inconsistency.rateation_id.slice(-8)}
                                {inconsistency.details.expected_count && inconsistency.details.actual_count && (
                                  <> • Atteso: {inconsistency.details.expected_count}, Trovato: {inconsistency.details.actual_count}</>
                                )}
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => repairInconsistency(inconsistency)}
                            disabled={loading}
                            className="ml-2"
                          >
                            <Wrench className="h-3 w-3" />
                          </Button>
                        </div>
                      </Alert>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="text-xs text-muted-foreground">
              Ultima verifica: {health.last_check.toLocaleString('it-IT')}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};