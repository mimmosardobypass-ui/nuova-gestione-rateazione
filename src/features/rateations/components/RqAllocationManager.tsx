import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Plus, 
  Activity, 
  AlertTriangle, 
  Users, 
  TrendingUp,
  Loader2,
  RefreshCw 
} from 'lucide-react';
import { RqAllocationForm } from './RqAllocationForm';
import { useRqAllocation } from '../hooks/useRqAllocation';
import { formatAllocationCents } from '@/lib/utils/rq-allocation';

interface RqAllocationManagerProps {
  className?: string;
}

export function RqAllocationManager({ className }: RqAllocationManagerProps) {
  const [showForm, setShowForm] = useState(false);
  const { availablePagopa, availableRq, loading, error, reload } = useRqAllocation();

  const handleFormSuccess = () => {
    setShowForm(false);
    reload();
  };

  const handleRefresh = () => {
    reload();
  };

  // Calculate statistics
  const stats = {
    totalPagopaAllocatable: availablePagopa.reduce((sum, p) => sum + p.allocatable_cents, 0),
    pagopaCount: availablePagopa.length,
    rqCount: availableRq.length,
    totalRqCapacity: availableRq.reduce((sum, r) => sum + r.total_cents, 0)
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-12">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Caricamento dati allocazione...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="py-6">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button 
            onClick={handleRefresh} 
            variant="outline" 
            size="sm" 
            className="mt-4"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Riprova
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={className}>
      {/* Header with stats */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Gestione Allocazioni RQ
            </CardTitle>
            <div className="flex gap-2">
              <Button 
                onClick={handleRefresh}
                variant="outline" 
                size="sm"
                disabled={loading}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Aggiorna
              </Button>
              <Button 
                onClick={() => setShowForm(!showForm)}
                variant={showForm ? "secondary" : "default"}
                size="sm"
              >
                <Plus className="mr-2 h-4 w-4" />
                {showForm ? 'Nascondi Form' : 'Nuova Allocazione'}
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                {stats.pagopaCount}
              </div>
              <div className="text-sm text-muted-foreground">PagoPA Disponibili</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {formatAllocationCents(stats.totalPagopaAllocatable)}
              </div>
              <div className="text-sm text-muted-foreground">Quota Allocabile</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {stats.rqCount}
              </div>
              <div className="text-sm text-muted-foreground">RQ Attive</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {formatAllocationCents(stats.totalRqCapacity)}
              </div>
              <div className="text-sm text-muted-foreground">Capacità RQ Totale</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Form */}
      {showForm && (
        <div className="mb-6">
          <RqAllocationForm
            availablePagopa={availablePagopa}
            availableRq={availableRq}
            onSuccess={handleFormSuccess}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {/* Available Resources Overview */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Available PagoPA */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-green-600" />
              PagoPA Disponibili ({availablePagopa.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {availablePagopa.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nessuna PagoPA con quota disponibile</p>
                <p className="text-sm">Le PagoPA completamente allocate non vengono mostrate</p>
              </div>
            ) : (
              <div className="space-y-3">
                {availablePagopa.map((pagopa) => (
                  <div
                    key={pagopa.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div>
                      <div className="font-medium">{pagopa.number}</div>
                      {pagopa.taxpayer_name && (
                        <div className="text-sm text-muted-foreground">
                          {pagopa.taxpayer_name}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className="mb-1">
                        {formatAllocationCents(pagopa.allocatable_cents)}
                      </Badge>
                      <div className="text-xs text-muted-foreground">
                        di {formatAllocationCents(pagopa.residual_cents)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Available RQ */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-blue-600" />
              Riammissioni Quater Attive ({availableRq.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {availableRq.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nessuna RQ attiva disponibile</p>
                <p className="text-sm">Crea una nuova Riammissione Quater per iniziare</p>
              </div>
            ) : (
              <div className="space-y-3">
                {availableRq.map((rq) => (
                  <div
                    key={rq.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div>
                      <div className="font-medium">{rq.number}</div>
                      {rq.taxpayer_name && (
                        <div className="text-sm text-muted-foreground">
                          {rq.taxpayer_name}
                        </div>
                      )}
                    </div>
                    <div>
                      <Badge variant="secondary">
                        {formatAllocationCents(rq.total_cents)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Help/Info */}
      {!showForm && availablePagopa.length > 0 && availableRq.length > 0 && (
        <Card className="mt-6">
          <CardContent className="py-4">
            <Alert>
              <Activity className="h-4 w-4" />
              <AlertDescription>
                <strong>Allocazione RQ:</strong> Collega quote PagoPA alle Riammissioni Quater per ottimizzare 
                i pagamenti e calcolare automaticamente i risparmi. Clicca "Nuova Allocazione" per iniziare.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}
    </div>
  );
}