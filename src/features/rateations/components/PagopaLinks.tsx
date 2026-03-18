import { useEffect, useState } from "react";
import { ExternalLink, Calendar, Euro, Users } from "lucide-react";
import { getLinksForPagopa, getR5LinksForPagopa, PagopaLinkRow, QuinquiesLinkRow } from "../api/links";
import { formatEuroFromCents } from "@/lib/formatters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface PagopaLinksProps {
  pagopaId: number;
  onGoToRQ?: (rqId: number) => void;
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

export function PagopaLinks({ pagopaId, onGoToRQ }: PagopaLinksProps) {
  const [rqRows, setRqRows] = useState<PagopaLinkRow[]>([]);
  const [r5Rows, setR5Rows] = useState<QuinquiesLinkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadLinks = async () => {
      try {
        setLoading(true);
        setError(null);
        const [rqData, r5Data] = await Promise.all([
          getLinksForPagopa(pagopaId),
          getR5LinksForPagopa(pagopaId),
        ]);
        setRqRows(rqData);
        setR5Rows(r5Data);
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

  const hasNoLinks = rqRows.length === 0 && r5Rows.length === 0;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5" />
            Collegamenti Rottamazione
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
            Collegamenti Rottamazione
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-destructive">{error}</div>
        </CardContent>
      </Card>
    );
  }

  if (hasNoLinks) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5" />
            Collegamenti Rottamazione
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            Nessun collegamento Rottamazione per questa PagoPA.
          </div>
        </CardContent>
      </Card>
    );
  }

  // Aggregati RQ
  const residuoPagopa = rqRows.length > 0 
    ? (rqRows[0].residuo_pagopa_at_link_cents || 0) 
    : 0;
  const totaleRQcollegati = rqRows.reduce((sum, row) => 
    sum + (row.totale_rq_at_link_cents || 0), 0);
  const risparmioRQ = Math.max(0, residuoPagopa - totaleRQcollegati);

  // Aggregati R5
  const totaleR5Risparmio = r5Rows.reduce((sum, row) => 
    sum + (row.risparmio_at_link_cents || 0), 0);

  const totalLinks = rqRows.length + r5Rows.length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 mb-2">
              <ExternalLink className="h-5 w-5" />
              Collegamenti Rottamazione
            </CardTitle>
            <Badge variant="outline" className="font-medium">
              {totalLinks} {totalLinks === 1 ? 'collegamento' : 'collegamenti'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Sezione RQ */}
          {rqRows.length > 0 && (
            <div className="space-y-4">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Badge variant="secondary">RQ</Badge>
                Riam.Quater
              </h4>

              {/* Testata aggregata RQ */}
              <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">Residuo PagoPA</div>
                  <div className="font-bold text-lg">{formatEuroFromCents(residuoPagopa)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">Totale RQ Collegati</div>
                  <div className="font-bold text-lg">{formatEuroFromCents(totaleRQcollegati)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">Risparmio Stimato</div>
                  <div className="font-bold text-lg text-green-600">{formatEuroFromCents(risparmioRQ)}</div>
                </div>
              </div>

              {rqRows.map((row, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-3 hover:bg-muted/30 transition-colors">
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
                      <Button variant="outline" size="sm" onClick={() => onGoToRQ(row.riam_quater_id)} className="flex items-center gap-1" aria-label={`Apri ${rqLabel(row.rq_number, row.riam_quater_id)}`}>
                        <ExternalLink className="h-3 w-3" />
                        Apri RQ
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div className="flex items-start gap-2">
                      <Users className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-medium text-xs text-muted-foreground uppercase tracking-wide">Contribuente RQ</div>
                        <div className="truncate">{row.rq_taxpayer || "—"}</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Users className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-medium text-xs text-muted-foreground uppercase tracking-wide">Contribuente PagoPA</div>
                        <div className="truncate">{row.pagopa_taxpayer || "—"}</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm pt-2 border-t">
                    <Euro className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium text-xs text-muted-foreground uppercase tracking-wide">Totale RQ</div>
                      <div className="font-bold">{formatEuroFromCents(row.totale_rq_at_link_cents || 0)}</div>
                    </div>
                  </div>
                  {row.note && (
                    <div className="text-sm text-muted-foreground italic pt-2 border-t">
                      <span className="font-medium">Nota:</span> {row.note}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Sezione R5 */}
          {r5Rows.length > 0 && (
            <div className="space-y-4">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Badge className="bg-violet-600 hover:bg-violet-700 text-white">R5</Badge>
                Rott. Quinquies
              </h4>

              {r5Rows.map((row) => (
                <div key={row.id} className="border rounded-lg p-4 space-y-3 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-violet-600 hover:bg-violet-700 text-white font-medium">
                        {row.r5_number || `R5 #${row.quinquies_id}`}
                      </Badge>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {formatDate(row.created_at)}
                      </div>
                    </div>
                    {onGoToRQ && (
                      <Button variant="outline" size="sm" onClick={() => onGoToRQ(row.quinquies_id)} className="flex items-center gap-1" aria-label={`Apri ${row.r5_number || 'R5'}`}>
                        <ExternalLink className="h-3 w-3" />
                        Apri R5
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div className="flex items-start gap-2">
                      <Users className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-medium text-xs text-muted-foreground uppercase tracking-wide">Contribuente R5</div>
                        <div className="truncate">{row.quinquies_taxpayer_at_link || "—"}</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Users className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-medium text-xs text-muted-foreground uppercase tracking-wide">Contribuente PagoPA</div>
                        <div className="truncate">{row.pagopa_taxpayer_at_link || "—"}</div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-sm pt-2 border-t">
                    <div className="flex items-center gap-2">
                      <Euro className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium text-xs text-muted-foreground uppercase tracking-wide">Residuo PagoPA</div>
                        <div className="font-bold">{formatEuroFromCents(row.pagopa_residual_at_link_cents || 0)}</div>
                      </div>
                    </div>
                    <div>
                      <div className="font-medium text-xs text-muted-foreground uppercase tracking-wide">Totale R5</div>
                      <div className="font-bold">{formatEuroFromCents(row.quinquies_total_at_link_cents || 0)}</div>
                    </div>
                    <div>
                      <div className="font-medium text-xs text-muted-foreground uppercase tracking-wide">Risparmio</div>
                      <div className="font-bold text-green-600">{formatEuroFromCents(row.risparmio_at_link_cents || 0)}</div>
                    </div>
                  </div>

                  {row.reason && (
                    <div className="text-sm text-muted-foreground italic pt-2 border-t">
                      <span className="font-medium">Nota:</span> {row.reason}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
