import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, Unlink, Eye } from 'lucide-react';
import { formatEuro } from '@/lib/formatters';
import { getF24Link, unlinkF24FromPagopa, type F24PagopaLink } from '../api/linkF24';
import { useToast } from '@/hooks/use-toast';
import { ExtraCostBadge, ExtraCostBreakdown } from './ExtraCostBadge';

interface F24LinksSectionProps {
  f24Id: number;
  onNavigateToRateation?: (rateationId: string) => void;
  onLinksChanged?: () => void;
}

export function F24LinksSection({ 
  f24Id, 
  onNavigateToRateation,
  onLinksChanged 
}: F24LinksSectionProps) {
  const [link, setLink] = useState<F24PagopaLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [unlinking, setUnlinking] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadLink();
  }, [f24Id]);

  const loadLink = async () => {
    setLoading(true);
    try {
      const data = await getF24Link(f24Id);
      setLink(data);
    } catch (error) {
      console.error('Error loading F24 link:', error);
      toast({
        title: "Errore",
        description: "Impossibile caricare il collegamento F24",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUnlink = async () => {
    if (!confirm('Scollegare questo F24 dalla PagoPA?')) return;

    setUnlinking(true);
    try {
      await unlinkF24FromPagopa(f24Id);
      
      toast({
        title: "Collegamento rimosso",
        description: "F24 scollegato dalla PagoPA",
      });

      await loadLink();
      onLinksChanged?.();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Impossibile scollegare",
        variant: "destructive"
      });
    } finally {
      setUnlinking(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!link) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Collegamento F24 → PagoPA</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Nessun collegamento a PagoPA configurato
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-orange-200">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <ArrowRight className="h-4 w-4" />
          PagoPA Collegata
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* PagoPA Info */}
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">{link.pagopa_number}</div>
            <div className="text-sm text-muted-foreground">
              {link.pagopa_taxpayer || 'N/A'}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {onNavigateToRateation && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigateToRateation(String(link.pagopa_id))}
              >
                <Eye className="w-4 h-4 mr-1" />
                Vedi
              </Button>
            )}
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleUnlink}
              disabled={unlinking}
            >
              <Unlink className="w-4 h-4 mr-1" />
              Scollega
            </Button>
          </div>
        </div>

        {/* Cost Breakdown */}
        <ExtraCostBreakdown
          residuoF24Cents={link.snapshot_f24_residual_cents}
          totalePagopaCents={link.pagopa_total_cents}
          maggiorazioneCents={link.maggiorazione_allocata_cents}
        />

        {/* Extra Cost Badge */}
        {link.maggiorazione_allocata_cents > 0 && (
          <div className="flex items-center gap-2 pt-2 border-t">
            <span className="text-sm text-muted-foreground">Costo aggiuntivo:</span>
            <ExtraCostBadge maggiorazioneCents={link.maggiorazione_allocata_cents} />
          </div>
        )}

        {/* Link Date & Notes */}
        <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
          <div>Collegato il: {new Date(link.linked_at).toLocaleDateString('it-IT')}</div>
          {link.reason && <div>Nota: {link.reason}</div>}
        </div>
      </CardContent>
    </Card>
  );
}
