import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Eye, Unlink2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { getPagopaLinkedToRiam, unlinkPagopaFromRiam } from "../api/rateations";
import type { RateationRow } from "../types";

interface RiamQuaterLinksSectionProps {
  riamQuaterId: string;
  onNavigateToRateation?: (rateationId: string) => void;
  onLinksChanged?: () => void;
}

interface LinkedPagoPA {
  id: string;
  number: string | null;
  taxpayer_name: string | null;
  total_amount: number | null;
  status: string;
  interrupted_by_rateation_id: string | null;
}

export function RiamQuaterLinksSection({ 
  riamQuaterId, 
  onNavigateToRateation, 
  onLinksChanged 
}: RiamQuaterLinksSectionProps) {
  const [linkedPagoPA, setLinkedPagoPA] = useState<LinkedPagoPA[]>([]);
  const [loading, setLoading] = useState(true);
  const [unlinking, setUnlinking] = useState<string | null>(null);

  useEffect(() => {
    loadLinkedPagoPA();
  }, [riamQuaterId]);

  const loadLinkedPagoPA = async () => {
    try {
      setLoading(true);
      const linked = await getPagopaLinkedToRiam(riamQuaterId);
      setLinkedPagoPA(linked);
    } catch (error: any) {
      console.error('Errore caricamento PagoPA collegate:', error);
      toast({
        title: "Errore",
        description: "Impossibile caricare le PagoPA collegate.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUnlink = async (pagopaId: string) => {
    try {
      setUnlinking(pagopaId);
      await unlinkPagopaFromRiam(pagopaId, riamQuaterId);
      toast({
        title: "Collegamento rimosso",
        description: "PagoPA scollegata con successo dalla Riam.Quater."
      });
      await loadLinkedPagoPA();
      onLinksChanged?.();
    } catch (error: any) {
      console.error('Errore rimozione collegamento:', error);
      toast({
        title: "Errore",
        description: "Impossibile rimuovere il collegamento.",
        variant: "destructive"
      });
    } finally {
      setUnlinking(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">PagoPA Collegate</CardTitle>
          <CardDescription>Caricamento...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-orange-500" />
          PagoPA Collegate
        </CardTitle>
        <CardDescription>
          Rateazioni PagoPA interrotte e collegate a questa Riammissione Quater
        </CardDescription>
      </CardHeader>
      <CardContent>
        {linkedPagoPA.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Nessuna PagoPA collegata a questa Riam.Quater.
          </p>
        ) : (
          <div className="space-y-3">
            {linkedPagoPA.map((pagopa) => (
              <div key={pagopa.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs">
                      PagoPA #{pagopa.number ?? '—'}
                    </Badge>
                    <Badge variant="destructive" className="text-xs">
                      INTERROTTA
                    </Badge>
                  </div>
                  <p className="text-sm font-medium">{pagopa.taxpayer_name || 'Senza nome'}</p>
                  <p className="text-xs text-muted-foreground">
                    Totale: €{Number(pagopa.total_amount ?? 0).toFixed(2)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {onNavigateToRateation && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onNavigateToRateation(pagopa.id)}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      Vedi
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleUnlink(pagopa.id)}
                    disabled={unlinking === pagopa.id}
                  >
                    <Unlink2 className="w-4 h-4 mr-1" />
                    {unlinking === pagopa.id ? 'Scollegando...' : 'Scollega'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}