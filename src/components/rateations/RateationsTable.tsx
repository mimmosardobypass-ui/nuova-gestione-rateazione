import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Pencil, Trash } from "lucide-react";
import { RateationRowDetails } from "./RateationRowDetails";
import { toast } from "@/hooks/use-toast";

export type RateationRow = {
  id: string;
  numero: string;
  tipo: string;
  contribuente: string;
  importoTotale: number;
  importoPagato: number;
  importoRitardo: number;
  residuo: number;
  rateTotali: number;
  ratePagate: number;
  rateNonPagate: number;
  rateInRitardo: number;
};

const rows: RateationRow[] = [
  {
    id: "1",
    numero: "R-2025-001",
    tipo: "F24",
    contribuente: "Mario Rossi",
    importoTotale: 3200,
    importoPagato: 2400,
    importoRitardo: 200,
    residuo: 800,
    rateTotali: 8,
    ratePagate: 6,
    rateNonPagate: 2,
    rateInRitardo: 1,
  },
  {
    id: "2",
    numero: "R-2025-002",
    tipo: "PagoPA",
    contribuente: "ACME S.p.A.",
    importoTotale: 5400,
    importoPagato: 5400,
    importoRitardo: 0,
    residuo: 0,
    rateTotali: 12,
    ratePagate: 12,
    rateNonPagate: 0,
    rateInRitardo: 0,
  },
];

export function RateationsTable() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => setExpandedId(prev => (prev === id ? null : id));

  return (
    <div className="w-full overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Numero</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Contribuente</TableHead>
            <TableHead>Totale</TableHead>
            <TableHead>Pagato</TableHead>
            <TableHead>In ritardo</TableHead>
            <TableHead>Residuo</TableHead>
            <TableHead>Rate</TableHead>
            <TableHead>Azioni</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <>
              <TableRow key={r.id} className="align-top">
                <TableCell className="font-medium">{r.numero}</TableCell>
                <TableCell><Badge variant="secondary">{r.tipo}</Badge></TableCell>
                <TableCell>{r.contribuente}</TableCell>
                <TableCell>€ {r.importoTotale.toLocaleString()}</TableCell>
                <TableCell>€ {r.importoPagato.toLocaleString()}</TableCell>
                <TableCell>€ {r.importoRitardo.toLocaleString()}</TableCell>
                <TableCell>€ {r.residuo.toLocaleString()}</TableCell>
                <TableCell>
                  <div className="text-sm">
                    <div className="font-medium">Totali: {r.rateTotali}</div>
                    <div className="text-muted-foreground">Pagate: {r.ratePagate} · Non pagate: {r.rateNonPagate} · Ritardo: {r.rateInRitardo}</div>
                  </div>
                </TableCell>
                <TableCell className="space-x-2 whitespace-nowrap">
                  <Button variant="ghost" size="sm" aria-label="Dettagli" onClick={() => toggleExpand(r.id)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" aria-label="Modifica" onClick={() => toast({ title: "Modifica", description: "WIP" })}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" aria-label="Elimina" onClick={() => toast({ title: "Elimina", description: "Conferma non implementata" })}>
                    <Trash className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
              {expandedId === r.id && (
                <TableRow key={`${r.id}-details`}>
                  <TableCell colSpan={9}>
                    <RateationRowDetails row={r} />
                  </TableCell>
                </TableRow>
              )}
            </>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
