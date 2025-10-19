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
import { supabase } from '@/integrations/supabase/client';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface F24PreviewData {
  f24_residual_cents: number;
  pagopa_total_cents: number;
  delta_cents: number;
}

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
  const [preview, setPreview] = useState<F24PreviewData | null>(null);

  const { toast } = useToast();

  // Load data when dialog opens
  useEffect(() => {
    if (open) {
      loadData();
    } else {
      // Reset on close
      setSelectedPagopaId(null);
      setNote('');
      setPreview(null);
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

  const loadPreview = async (pagopaId: number) => {
    try {
      console.log('[F24 PREVIEW] Loading for PagoPA:', pagopaId);
      
      const { data, error } = await supabase.rpc('preview_link_f24_to_pagopa', {
        p_f24_id: Number(f24.id),
        p_pagopa_id: pagopaId,
      });

      if (error) {
        console.error('[F24 PREVIEW] RPC error:', error);
        throw error;
      }

      const row = Array.isArray(data) ? data[0] : data;
      
      if (!row) {
        console.warn('[F24 PREVIEW] No data returned from RPC');
        setPreview(null);
        return;
      }

      const previewData: F24PreviewData = {
        f24_residual_cents: Number(row.f24_residual_cents ?? 0),
        pagopa_total_cents: Number(row.pagopa_total_cents ?? 0),
        delta_cents: Number(row.delta_cents ?? 0),
      };

      console.log('[F24 PREVIEW] Loaded:', previewData);
      setPreview(previewData);
    } catch (e: any) {
      console.error('[F24 PREVIEW] Error:', e);
      toast({
        variant: 'destructive',
        title: 'Errore',
        description: 'Impossibile caricare anteprima collegamento',
      });
      setPreview(null);
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
                onValueChange={(v) => {
                  const id = Number(v);
                  setSelectedPagopaId(id);
                  loadPreview(id);
                }}
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

            {/* Preview Collegamento da RPC */}
            {preview && selectedPagopaId && (
              <Card className={cn(
                "border-2",
                preview.delta_cents >= 0 
                  ? "border-red-200 bg-red-50" 
                  : "border-green-200 bg-green-50"
              )}>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    {preview.delta_cents >= 0 ? (
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                    ) : (
                      <span className="text-green-600">✓</span>
                    )}
                    Anteprima Collegamento
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Residuo F24 (decaduto):</span>
                    <span className="font-mono font-medium">
                      {formatEuro(preview.f24_residual_cents / 100)}
                    </span>
                  </div>
                  
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Totale PagoPA:</span>
                    <span className="font-mono font-medium">
                      {formatEuro(preview.pagopa_total_cents / 100)}
                    </span>
                  </div>
                  
                  <Separator className="my-2" />
                  
                  <div className={cn(
                    "flex justify-between text-sm font-bold",
                    preview.delta_cents >= 0 ? "text-red-700" : "text-green-700"
                  )}>
                    <span>
                      {preview.delta_cents >= 0 
                        ? '⚠️ Extra costo (maggiorazione):' 
                        : '✓ Risparmio:'}
                    </span>
                    <span className="font-mono">
                      {preview.delta_cents >= 0 ? '+' : '−'}
                      {formatEuro(Math.abs(preview.delta_cents) / 100)}
                    </span>
                  </div>

                  {preview.delta_cents > 0 && (
                    <p className="text-xs text-muted-foreground mt-2 italic">
                      La PagoPA ha un importo superiore al residuo F24. 
                      La differenza verrà tracciata come maggiorazione allocata.
                    </p>
                  )}

                  {preview.delta_cents < 0 && (
                    <p className="text-xs text-green-700 mt-2 italic">
                      La PagoPA ha un importo inferiore al residuo F24. 
                      Questo collegamento genera un risparmio.
                    </p>
                  )}

                  {preview.delta_cents === 0 && (
                    <p className="text-xs text-muted-foreground mt-2 italic">
                      La PagoPA ha esattamente lo stesso importo del residuo F24. 
                      Nessun costo aggiuntivo o risparmio.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Loading Preview */}
            {selectedPagopaId && !preview && (
              <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2" />
                Caricamento anteprima...
              </div>
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
            disabled={!selectedPagopaId || processing || loading || !preview}
          >
            {processing ? (
              'Collegamento...'
            ) : (
              <>
                {existingLink ? 'Aggiorna Collegamento' : 'Collega F24 a PagoPA'}
                {preview && preview.delta_cents !== 0 && (
                  <span className="ml-2 text-xs opacity-80">
                    ({preview.delta_cents > 0 ? '+' : ''}
                    {formatEuro(preview.delta_cents / 100)})
                  </span>
                )}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
