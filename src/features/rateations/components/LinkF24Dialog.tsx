import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, AlertTriangle, Link as LinkIcon, Unlink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatEuro } from '@/lib/formatters';
import type { RateationRow } from '../types';
import { 
  linkF24ToPagopa, 
  unlinkF24FromPagopa, 
  getPagopaOptionsForF24,
  getF24Link,
  type PagopaOption,
  type F24PagopaLink
} from '../api/linkF24';
import { ExtraCostBreakdown } from './ExtraCostBadge';

interface LinkF24DialogProps {
  f24: RateationRow;
  trigger: React.ReactNode;
  onLinkComplete?: () => void;
}

export function LinkF24Dialog({ f24, trigger, onLinkComplete }: LinkF24DialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [pagopaOptions, setPagopaOptions] = useState<PagopaOption[]>([]);
  const [selectedPagopaId, setSelectedPagopaId] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [existingLink, setExistingLink] = useState<F24PagopaLink | null>(null);

  const { toast } = useToast();

  // Load data when dialog opens
  useEffect(() => {
    if (open) {
      loadData();
    } else {
      // Reset on close
      setSelectedPagopaId(null);
      setNote('');
    }
  }, [open]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [options, link] = await Promise.all([
        getPagopaOptionsForF24(Number(f24.id)),
        getF24Link(Number(f24.id))
      ]);
      
      setPagopaOptions(options);
      setExistingLink(link);
    } catch (error) {
      console.error('Error loading F24 link data:', error);
      toast({
        title: "Errore",
        description: "Errore nel caricamento delle opzioni PagoPA",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLink = async () => {
    if (!selectedPagopaId) {
      toast({
        title: "Seleziona una PagoPA",
        description: "Devi selezionare una PagoPA di destinazione",
        variant: "destructive"
      });
      return;
    }

    setProcessing(true);
    try {
      const result = await linkF24ToPagopa(
        Number(f24.id),
        selectedPagopaId,
        note.trim() || undefined
      );

      toast({
        title: result.action === 'created' ? "Collegamento creato" : "Collegamento aggiornato",
        description: `F24 collegato a PagoPA. Maggiorazione: +${formatEuro(result.maggiorazione_cents / 100)}`,
        duration: 5000
      });

      window.dispatchEvent(new CustomEvent('rateations:reload-kpis'));
      setOpen(false);
      onLinkComplete?.();
    } catch (error: any) {
      toast({
        title: "Errore collegamento",
        description: error.message || "Errore durante il collegamento",
        variant: "destructive"
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleUnlink = async () => {
    if (!confirm('Scollegare questo F24 dalla PagoPA? Lo stato tornerà ATTIVA.')) {
      return;
    }

    setProcessing(true);
    try {
      const result = await unlinkF24FromPagopa(Number(f24.id));

      toast({
        title: "Collegamento rimosso",
        description: result.f24_restored 
          ? 'F24 ripristinato allo stato ATTIVA'
          : 'Collegamento eliminato',
      });

      window.dispatchEvent(new CustomEvent('rateations:reload-kpis'));
      setOpen(false);
      onLinkComplete?.();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Impossibile scollegare",
        variant: "destructive"
      });
    } finally {
      setProcessing(false);
    }
  };

  // Calculate preview
  const selectedPagopa = pagopaOptions.find(p => p.id === selectedPagopaId);
  const f24ResiduoCents = (f24.residuo || 0) * 100;
  const pagopaTotalCents = selectedPagopa?.pagopa_total_cents || 0;
  const maggiorazioneCents = Math.max(0, pagopaTotalCents - f24ResiduoCents);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5" />
            Collega F24 Decaduto a PagoPA - {f24.numero}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Existing Link Info */}
            {existingLink && (
              <Card className="border-orange-200 bg-orange-50">
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                    Collegamento Esistente
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Collegato a PagoPA:</span>{' '}
                    <span className="font-medium">{existingLink.pagopa_number}</span>
                  </div>
                  
                  <ExtraCostBreakdown
                    residuoF24Cents={existingLink.snapshot_f24_residual_cents}
                    totalePagopaCents={existingLink.pagopa_total_cents}
                    maggiorazioneCents={existingLink.maggiorazione_allocata_cents}
                  />

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleUnlink}
                    disabled={processing}
                    className="w-full mt-2"
                  >
                    <Unlink className="w-4 h-4 mr-2" />
                    Scollega F24 dalla PagoPA
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* F24 Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">F24 Decaduto</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Numero:</span>
                  <span className="font-medium">{f24.numero}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Contribuente:</span>
                  <span>{f24.contribuente || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Residuo:</span>
                  <span className="font-mono">{formatEuro(f24.residuo || 0)}</span>
                </div>
              </CardContent>
            </Card>

            {/* PagoPA Selection */}
            <div className="space-y-2">
              <Label htmlFor="pagopa-select">Seleziona PagoPA di Destinazione</Label>
              <Select
                value={selectedPagopaId ? String(selectedPagopaId) : undefined}
                onValueChange={(v) => setSelectedPagopaId(Number(v))}
                disabled={processing}
              >
                <SelectTrigger id="pagopa-select">
                  <SelectValue placeholder="Scegli una PagoPA..." />
                </SelectTrigger>
                <SelectContent>
                  {pagopaOptions.length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground text-center">
                      Nessuna PagoPA disponibile
                    </div>
                  ) : (
                    pagopaOptions.map((pagopa) => (
                      <SelectItem key={pagopa.id} value={String(pagopa.id)}>
                        <div className="flex items-center justify-between w-full gap-4">
                          <span>{pagopa.number}</span>
                          <span className="text-xs font-mono text-muted-foreground">
                            {formatEuro(pagopa.pagopa_total_cents / 100)}
                          </span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Preview Calculation */}
            {selectedPagopa && (
              <Card className={maggiorazioneCents > 0 ? 'border-destructive/50 bg-destructive/5' : 'border-green-200 bg-green-50'}>
                <CardHeader>
                  <CardTitle className="text-sm">Anteprima Collegamento</CardTitle>
                </CardHeader>
                <CardContent>
                  <ExtraCostBreakdown
                    residuoF24Cents={f24ResiduoCents}
                    totalePagopaCents={pagopaTotalCents}
                    maggiorazioneCents={maggiorazioneCents}
                  />
                  
                  {maggiorazioneCents === 0 && (
                    <div className="mt-3 text-sm text-green-700">
                      ✓ Nessun costo aggiuntivo (PagoPA ≤ Residuo F24)
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Note */}
            <div className="space-y-2">
              <Label htmlFor="note">Note (opzionale)</Label>
              <Textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Aggiungi note sul collegamento..."
                rows={3}
                disabled={processing}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={processing}>
            Annulla
          </Button>
          <Button
            onClick={handleLink}
            disabled={!selectedPagopaId || processing || loading}
          >
            {processing ? 'Collegamento...' : existingLink ? 'Aggiorna Collegamento' : 'Collega F24 a PagoPA'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
