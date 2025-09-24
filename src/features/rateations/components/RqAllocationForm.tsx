import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, CheckCircle2, ArrowUpDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { linkPagopaToRQ, mapRqLinkError } from '@/features/rateations/api/linkPagopa';
import { 
  eurToCentsForAllocation, 
  validateQuotaInput, 
  formatAllocationCents,
  createAllocationSummary 
} from '@/lib/utils/rq-allocation';

interface PagopaOption {
  id: number;
  number: string;
  taxpayer_name?: string;
  allocatable_cents: number;
  residual_cents: number;
}

interface RqOption {
  id: number;
  number: string;
  taxpayer_name?: string;
  total_cents: number;
}

interface RqAllocationFormProps {
  availablePagopa: PagopaOption[];
  availableRq: RqOption[];
  onSuccess?: () => void;
  onCancel?: () => void;
  loading?: boolean;
}

export function RqAllocationForm({
  availablePagopa,
  availableRq,
  onSuccess,
  onCancel,
  loading = false
}: RqAllocationFormProps) {
  const [selectedPagopa, setSelectedPagopa] = useState<number | null>(null);
  const [selectedRq, setSelectedRq] = useState<number | null>(null);
  const [quotaInput, setQuotaInput] = useState('');
  const [note, setNote] = useState('');
  const [isAllocating, setIsAllocating] = useState(false);
  
  const { toast } = useToast();

  // Get selected PagoPA details
  const pagopaDetails = selectedPagopa 
    ? availablePagopa.find(p => p.id === selectedPagopa) 
    : null;
  
  // Get selected RQ details  
  const rqDetails = selectedRq 
    ? availableRq.find(r => r.id === selectedRq) 
    : null;

  // Validate quota input
  const quotaValidation = validateQuotaInput(
    quotaInput, 
    pagopaDetails?.allocatable_cents
  );

  // Check if form is valid
  const isFormValid = selectedPagopa && 
                      selectedRq && 
                      quotaValidation.isValid && 
                      !isAllocating && 
                      !loading;

  // Create allocation summary for preview
  const allocationSummary = pagopaDetails ? createAllocationSummary(
    pagopaDetails.residual_cents,
    quotaValidation.isValid ? quotaValidation.cents : 0
  ) : null;

  const handleAllocate = async () => {
    if (!isFormValid || !quotaValidation.isValid) return;

    setIsAllocating(true);
    
    try {
      const result = await linkPagopaToRQ(
        selectedPagopa!,
        selectedRq!,
        quotaValidation.cents,
        note || undefined
      );

      toast({
        title: 'Allocazione completata',
        description: `Quota € ${formatAllocationCents(quotaValidation.cents)} allocata (${result.action === 'created' ? 'nuova' : 'aggiornata'})`,
        variant: 'default',
      });

      // Reset form
      setSelectedPagopa(null);
      setSelectedRq(null);
      setQuotaInput('');
      setNote('');
      
      onSuccess?.();
    } catch (error: any) {
      const userMessage = mapRqLinkError(error);
      toast({
        title: 'Errore allocazione',
        description: userMessage,
        variant: 'destructive',
      });
      console.error('RQ allocation error:', error);
    } finally {
      setIsAllocating(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowUpDown className="h-5 w-5" />
          Nuova Allocazione RQ
        </CardTitle>
        <CardDescription>
          Collega una quota PagoPA a una Riammissione Quater per ottimizzare i pagamenti
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* PagoPA Selection */}
        <div className="space-y-2">
          <Label htmlFor="pagopa-select">Piano PagoPA di origine</Label>
          <Select value={selectedPagopa?.toString() || ''} onValueChange={(val) => setSelectedPagopa(Number(val))}>
            <SelectTrigger id="pagopa-select">
              <SelectValue placeholder="Seleziona un piano PagoPA..." />
            </SelectTrigger>
            <SelectContent>
              {availablePagopa.map((pagopa) => (
                <SelectItem key={pagopa.id} value={pagopa.id.toString()}>
                  <div className="flex items-center justify-between w-full">
                    <div>
                      <span className="font-medium">{pagopa.number}</span>
                      {pagopa.taxpayer_name && (
                        <span className="text-muted-foreground ml-2">
                          - {pagopa.taxpayer_name}
                        </span>
                      )}
                    </div>
                    <Badge variant="outline">
                      {formatAllocationCents(pagopa.allocatable_cents)} disponibili
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {pagopaDetails && (
            <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
              <div>Residuo totale: <strong>{formatAllocationCents(pagopaDetails.residual_cents)}</strong></div>
              <div>Quota disponibile: <strong>{formatAllocationCents(pagopaDetails.allocatable_cents)}</strong></div>
            </div>
          )}
        </div>

        {/* RQ Selection */}
        <div className="space-y-2">
          <Label htmlFor="rq-select">Riammissione Quater di destinazione</Label>
          <Select value={selectedRq?.toString() || ''} onValueChange={(val) => setSelectedRq(Number(val))}>
            <SelectTrigger id="rq-select">
              <SelectValue placeholder="Seleziona una RQ..." />
            </SelectTrigger>
            <SelectContent>
              {availableRq.map((rq) => (
                <SelectItem key={rq.id} value={rq.id.toString()}>
                  <div className="flex items-center justify-between w-full">
                    <div>
                      <span className="font-medium">{rq.number}</span>
                      {rq.taxpayer_name && (
                        <span className="text-muted-foreground ml-2">
                          - {rq.taxpayer_name}
                        </span>
                      )}
                    </div>
                    <Badge variant="secondary">
                      {formatAllocationCents(rq.total_cents)}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Quota Input */}
        <div className="space-y-2">
          <Label htmlFor="quota-input">Quota da allocare (€)</Label>
          <div className="space-y-2">
            <Input
              id="quota-input"
              type="text"
              value={quotaInput}
              onChange={(e) => setQuotaInput(e.target.value)}
              placeholder="es. 1.500,00"
            className={quotaValidation.isValid ? 'border-green-500' : quotaValidation.errorMessage ? 'border-red-500' : ''}
            />
            
            {quotaValidation.errorMessage && (
              <div className="flex items-center gap-2 text-sm text-red-600">
                <AlertTriangle className="h-4 w-4" />
                {quotaValidation.errorMessage}
              </div>
            )}
            
            {quotaValidation.isValid && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                Quota valida: {formatAllocationCents(quotaValidation.cents)}
              </div>
            )}
          </div>
        </div>

        {/* Allocation Summary */}
        {allocationSummary && quotaValidation.isValid && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4 space-y-2">
            <h4 className="font-medium text-blue-900">Anteprima allocazione</h4>
            <div className="text-sm text-blue-800 space-y-1">
              <div>Utilizzo: <strong>{allocationSummary.utilizationPercentage.toFixed(1)}%</strong> del residuo PagoPA</div>
              <div>Rimanente dopo allocazione: <strong>{allocationSummary.formattedAvailable}</strong></div>
            </div>
          </div>
        )}

        {/* Note */}
        <div className="space-y-2">
          <Label htmlFor="note-input">Note (opzionale)</Label>
          <Textarea
            id="note-input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Aggiungi una nota per questa allocazione..."
            rows={3}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <Button
            onClick={handleAllocate}
            disabled={!isFormValid}
            className="flex-1"
          >
            {isAllocating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isAllocating ? 'Allocazione...' : 'Alloca Quota'}
          </Button>
          
          {onCancel && (
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={isAllocating}
            >
              Annulla
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}