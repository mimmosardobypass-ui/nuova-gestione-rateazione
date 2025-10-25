import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, FileText, ArrowRight } from 'lucide-react';

interface AtRiskReportSelectorProps {
  f24Count: number;
  pagopaCount: number;
}

/**
 * Selettore globale per scegliere quale report a rischio visualizzare
 */
export function AtRiskReportSelector({ f24Count, pagopaCount }: AtRiskReportSelectorProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const totalCount = f24Count + pagopaCount;

  // Non mostrare il pulsante se non ci sono rateazioni a rischio
  if (totalCount === 0) return null;

  const handleSelection = (filter: 'f24-at-risk' | 'pagopa-at-risk' | 'unified-at-risk') => {
    setOpen(false);
    navigate(`/rateazioni?filter=${filter}`);
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
              onClick={() => handleSelection('f24-at-risk')}
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
              onClick={() => handleSelection('pagopa-at-risk')}
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

            {/* Unified Card */}
            <Card 
              className="cursor-pointer hover:border-primary transition-colors border-2"
              onClick={() => handleSelection('unified-at-risk')}
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center justify-between">
                  <span>Report Completo (F24 + PagoPA)</span>
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
