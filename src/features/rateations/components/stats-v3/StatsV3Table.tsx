import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { StatsV3Detail } from "../../hooks/useStatsV3";
import { formatEuroFromCents, formatTypeLabel, formatStatusLabel, formatPercentage } from "../../utils/statsV3Formatters";
import { useNavigate } from "react-router-dom";

interface StatsV3TableProps {
  details: StatsV3Detail[];
}

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  attiva: "default",
  completata: "secondary",
  interrotta: "outline",
  decaduta: "destructive",
  estinta: "secondary",
};

export function StatsV3Table({ details }: StatsV3TableProps) {
  const navigate = useNavigate();

  const handleRowClick = (id: number) => {
    navigate(`/rateazioni?highlight=${id}`);
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-base font-semibold">📋 Dettaglio Rateazioni</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Numero</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>Contribuente</TableHead>
                <TableHead className="text-right">Totale</TableHead>
                <TableHead className="text-right">Pagato</TableHead>
                <TableHead className="text-right">Residuo</TableHead>
                <TableHead className="text-right">In Ritardo</TableHead>
                <TableHead className="text-center">Rate</TableHead>
                <TableHead className="text-right">% Compl.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {details.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                    Nessun dato disponibile con i filtri selezionati
                  </TableCell>
                </TableRow>
              ) : (
                details.slice(0, 50).map((detail) => (
                  <TableRow
                    key={detail.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleRowClick(detail.id)}
                  >
                    <TableCell className="font-medium">{detail.number}</TableCell>
                    <TableCell>{formatTypeLabel(detail.type)}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[detail.status] || "default"}>
                        {formatStatusLabel(detail.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {detail.taxpayer_name || "N/A"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatEuroFromCents(detail.total_cents)}
                    </TableCell>
                    <TableCell className="text-right text-green-600">
                      {formatEuroFromCents(detail.paid_cents)}
                    </TableCell>
                    <TableCell className="text-right text-amber-600">
                      {formatEuroFromCents(detail.residual_cents)}
                    </TableCell>
                    <TableCell className="text-right text-orange-600">
                      {formatEuroFromCents(detail.overdue_cents)}
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      {detail.installments_paid} / {detail.installments_total}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatPercentage(detail.completion_percent)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {details.length > 50 && (
            <div className="text-center text-sm text-muted-foreground mt-4">
              Mostrando i primi 50 risultati su {details.length} totali
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
