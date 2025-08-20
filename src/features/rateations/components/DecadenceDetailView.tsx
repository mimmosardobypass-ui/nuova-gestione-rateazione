import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatEuro } from "@/lib/formatters";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { ArrowRight, ExternalLink, Plus } from "lucide-react";
import { DecadenceDetail } from "../types";

interface DecadenceDetailViewProps {
  decadenceDetails: DecadenceDetail[];
  onCreatePagoPA: (f24Id: number, amount: number) => void;
  onOpenRateation: (id: number) => void;
  loading?: boolean;
}

export function DecadenceDetailView({
  decadenceDetails,
  onCreatePagoPA,
  onOpenRateation,
  loading = false
}: DecadenceDetailViewProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Piani Decaduti</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (decadenceDetails.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Piani Decaduti</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center p-8 text-muted-foreground">
            <p>Nessun piano decaduto al momento.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Piani Decaduti
          <Badge variant="secondary">{decadenceDetails.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Numero</TableHead>
                <TableHead>Contribuente</TableHead>
                <TableHead>Data Decadenza</TableHead>
                <TableHead className="text-right">Decaduto</TableHead>
                <TableHead className="text-right">Trasferito</TableHead>
                <TableHead className="text-right">Da Trasferire</TableHead>
                <TableHead className="text-center">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {decadenceDetails.map((detail) => (
                <TableRow key={detail.id}>
                  <TableCell className="font-medium">
                    {detail.number}
                  </TableCell>
                  <TableCell>
                    {detail.taxpayer_name || '-'}
                  </TableCell>
                  <TableCell>
                    {format(new Date(detail.decadence_at), 'dd/MM/yyyy', { locale: it })}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatEuro(detail.residual_at_decadence)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {formatEuro(detail.transferred_amount)}
                      {detail.transferred_amount > 0 && (
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatEuro(detail.to_transfer)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onOpenRateation(detail.id)}
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Apri
                      </Button>
                      
                      {detail.to_transfer > 0 && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => onCreatePagoPA(detail.id, detail.to_transfer)}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Crea PagoPA
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}