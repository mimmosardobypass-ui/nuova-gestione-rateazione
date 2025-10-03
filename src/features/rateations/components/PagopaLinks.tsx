import { useEffect, useState } from "react";
import { ExternalLink, Calendar, Euro, Users } from "lucide-react";
import { getLinksForPagopa, PagopaLinkRow } from "../api/links";
import { formatEuroFromCents } from "@/lib/formatters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface PagopaLinksProps {
  pagopaId: number;
  onGoToRQ?: (rqId: number) => void;
}

export function PagopaLinks({ pagopaId, onGoToRQ }: PagopaLinksProps) {
  const [rows, setRows] = useState<PagopaLinkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadLinks = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getLinksForPagopa(pagopaId);
        setRows(data);
      } catch (err) {
        console.error("Failed to load PagoPA links:", err);
        setError("Errore nel caricamento dei collegamenti");
      } finally {
        setLoading(false);
      }
    };

    if (pagopaId) {
      loadLinks();
    }
  }, [pagopaId]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5" />
            Collegamenti Riam.Quater
          </CardTitle>
        </CardHeader>
        <CardContent role="status" aria-live="polite">
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5" />
            Collegamenti Riam.Quater
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-destructive">{error}</div>
        </CardContent>
      </Card>
    );
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5" />
            Collegamenti Riam.Quater
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            Nessun collegamento Riam.Quater per questa PagoPA.
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr).toLocaleDateString("it-IT", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      });
    } catch {
      return "—";
    }
  };

  const rqLabel = (number: string | null, id: number) => {
    if (number) return number;
    const idStr = id.toString();
    return idStr.length >= 6 ? `RQ ${idStr.slice(-6)}` : `RQ ${idStr || '—'}`;
  };

  // Calcoli aggregati per evitare doppio conteggio
  const residuoPagopa = rows.length > 0 
    ? (rows[0].residuo_pagopa_at_link_cents || 0) 
    : 0;
  
  const totaleRQcollegati = rows.reduce((sum, row) => 
    sum + (row.totale_rq_at_link_cents || 0), 0);
  
  const risparmioComplessivo = Math.max(0, residuoPagopa - totaleRQcollegati);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 mb-2">
              <ExternalLink className="h-5 w-5" />
              Collegamenti Riam.Quater
            </CardTitle>
            <Badge variant="outline" className="font-medium">
              {rows.length} {rows.length === 1 ? 'collegamento' : 'collegamenti'}
            </Badge>
          </div>
        </div>

        {/* Testata aggregata con totali complessivi */}
        <div className="grid grid-cols-3 gap-4 mt-4 p-4 bg-muted/50 rounded-lg">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide">
              Residuo PagoPA
            </div>
            <div className="font-bold text-lg">
              {formatEuroFromCents(residuoPagopa)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide">
              Totale RQ Collegati
            </div>
            <div className="font-bold text-lg">
              {formatEuroFromCents(totaleRQcollegati)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide">
              Risparmio Stimato
            </div>
            <div className="font-bold text-lg text-green-600">
              {formatEuroFromCents(risparmioComplessivo)}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {rows.map((row, index) => (
            <div 
              key={index} 
              className="border rounded-lg p-4 space-y-3 hover:bg-muted/30 transition-colors"
            >
              {/* Header con RQ e data */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="font-medium">
                    {rqLabel(row.rq_number, row.riam_quater_id)}
                  </Badge>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {formatDate(row.linked_at)}
                  </div>
                </div>
                {onGoToRQ && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => onGoToRQ(row.riam_quater_id)}
                    className="flex items-center gap-1"
                    aria-label={`Apri ${rqLabel(row.rq_number, row.riam_quater_id)}`}
                  >
                    <ExternalLink className="h-3 w-3" />
                    Apri RQ
                  </Button>
                )}
              </div>

              {/* Contribuenti */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="flex items-start gap-2">
                  <Users className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-medium text-xs text-muted-foreground uppercase tracking-wide">
                      Contribuente RQ
                    </div>
                    <div className="truncate">{row.rq_taxpayer || "—"}</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Users className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-medium text-xs text-muted-foreground uppercase tracking-wide">
                      Contribuente PagoPA
                    </div>
                    <div className="truncate">{row.pagopa_taxpayer || "—"}</div>
                  </div>
                </div>
              </div>

              {/* Totale RQ */}
              <div className="flex items-center gap-2 text-sm pt-2 border-t">
                <Euro className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="font-medium text-xs text-muted-foreground uppercase tracking-wide">
                    Totale RQ
                  </div>
                  <div className="font-bold">
                    {formatEuroFromCents(row.totale_rq_at_link_cents || 0)}
                  </div>
                </div>
              </div>

              {/* Nota se presente */}
              {row.note && (
                <div className="text-sm text-muted-foreground italic pt-2 border-t">
                  <span className="font-medium">Nota:</span> {row.note}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}