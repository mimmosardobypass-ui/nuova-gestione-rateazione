import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, FileText, ArrowRight, Clock } from 'lucide-react';
import { PrintService } from '@/utils/printUtils';

interface AtRiskReportSelectorProps {
  f24Count: number;
  pagopaCount: number;
  quaterCount: number;
}

/**
 * Selettore globale per scegliere quale report a rischio visualizzare
 * Include F24, PagoPA e Quater (Rottamazione Quater + Riam.Quater)
 */
export function AtRiskReportSelector({ f24Count, pagopaCount, quaterCount }: AtRiskReportSelectorProps) {
  const [open, setOpen] = useState(false);

  const totalCount = f24Count + pagopaCount + quaterCount;

  // Non mostrare il pulsante se non ci sono rateazioni a rischio
  if (totalCount === 0) return null;

  const handleSelection = (reportType: 'f24' | 'pagopa' | 'quater' | 'unified') => {
    setOpen(false);
    
    switch (reportType) {
      case 'f24':
        PrintService.openF24AtRiskPreview();
        break;
      case 'pagopa':
        PrintService.openPagopaAtRiskPreview();
        break;
      case 'quater':
        PrintService.openQuaterAtRiskPreview();
        break;
      case 'unified':
        PrintService.openUnifiedAtRiskPreview();
        break;
    }
  };

  return (
    <>
      <div className="flex justify-center">
        <Button
          onClick={() => setOpen(true)}
          variant="outline"
          size="lg"
          className="gap-2 border-destructive/50 hover:bg-destructive/10"
        >
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <span>Vedi Rateazioni a Rischio ({totalCount})</span>
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Seleziona Report da Visualizzare
            </DialogTitle>
            <DialogDescription>
              Scegli quale tipo di rateazioni a rischio vuoi visualizzare e stampare
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* F24 Card */}
            <Card 
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => handleSelection('f24')}
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center justify-between">
                  <span>Solo F24 a Rischio</span>
                  <span className="text-destructive font-bold">{f24Count}</span>
                </CardTitle>
                <CardDescription>
                  Rateazioni F24 con giorni al prossimo pagamento ≤ 20
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Visualizza e stampa report F24
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            {/* PagoPA Card */}
            <Card 
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => handleSelection('pagopa')}
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center justify-between">
                  <span>Solo PagoPA a Rischio</span>
                  <span className="text-orange-600 font-bold">{pagopaCount}</span>
                </CardTitle>
                <CardDescription>
                  Rateazioni PagoPA con rate scadute ≥ 7 e skip residui bassi
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Visualizza e stampa report PagoPA
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            {/* Quater Card */}
            <Card 
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => handleSelection('quater')}
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span>Solo Quater a Rischio</span>
                  </div>
                  <span className="text-amber-600 font-bold">{quaterCount}</span>
                </CardTitle>
                <CardDescription>
                  Rottamazione Quater e Riam.Quater con decadenza entro 20 giorni
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Visualizza e stampa report Quater
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            {/* Unified Card */}
            <Card 
              className="cursor-pointer hover:border-primary transition-colors border-2"
              onClick={() => handleSelection('unified')}
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center justify-between">
                  <span>Report Completo (F24 + PagoPA + Quater)</span>
                  <span className="text-primary font-bold">{totalCount}</span>
                </CardTitle>
                <CardDescription>
                  Tutte le rateazioni a rischio in un unico report
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Visualizza e stampa report unificato
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
