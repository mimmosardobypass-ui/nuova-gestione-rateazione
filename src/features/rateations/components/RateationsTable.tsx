import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { RateationRowDetails } from "./RateationRowDetails";
import { EditRateationModal } from "./EditRateationModal";
import type { RateationRow } from "../types";
import { formatEuro } from "@/lib/formatters";

interface RateationsTableProps {
  rows: RateationRow[];
  loading: boolean;
  error: string | null;
  online: boolean;
  onDelete: (id: string) => void;
  onRefresh: () => void;
  onDataChanged?: () => void;
  deleting?: string | null;
}

export function RateationsTable({ rows, loading, error, online, onDelete, onRefresh, onDataChanged, deleting }: RateationsTableProps) {
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [editId, setEditId] = React.useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  

  if (loading) {
    return <div className="text-center py-8">Caricamento rateazioni...</div>;
  }

  if (error) {
    return <div className="text-center py-8 text-red-600">Errore: {error}</div>;
  }

  if (!online) {
    return <div className="text-center py-8 text-orange-600">Offline - dati non aggiornati</div>;
  }

  if (!rows.length) {
    return <div className="text-center py-8 text-muted-foreground">Nessuna rateazione trovata.</div>;
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            {/* LOVABLE:START columns */}
            <TableHead>Numero</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Contribuente</TableHead>
            <TableHead>Totale</TableHead>
            <TableHead>Pagato</TableHead>
            <TableHead>Ritardo</TableHead>
            <TableHead>Residuo</TableHead>
            <TableHead>Rate (T/P/NP/R)</TableHead>
            <TableHead>Azioni</TableHead>
            {/* LOVABLE:END columns */}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <React.Fragment key={row.id}>
              <TableRow>
                <TableCell>{row.numero}</TableCell>
                <TableCell>{row.tipo}</TableCell>
                <TableCell>{row.contribuente || "N/A"}</TableCell>
                <TableCell>{formatEuro(row.importoTotale)}</TableCell>
                <TableCell>{formatEuro(row.importoPagato)}</TableCell>
                <TableCell className={row.importoRitardo > 0 ? "text-red-600 font-medium" : ""}>
                  {formatEuro(row.importoRitardo)}
                </TableCell>
                <TableCell>{formatEuro(row.residuo)}</TableCell>
                <TableCell>
                  {row.rateTotali}/{row.ratePagate}/{row.rateNonPagate}/
                  <span className={row.rateInRitardo > 0 ? "text-red-600 font-medium" : ""}>
                    {row.rateInRitardo}
                  </span>
                </TableCell>
                <TableCell>
                  {/* LOVABLE:START actions */}
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleExpand(row.id)}
                      className="h-8 w-8 p-0"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditId(row.id)}
                      className="h-8 w-8 p-0"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onDelete(row.id)}
                      disabled={deleting === row.id}
                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                    >
                      {deleting === row.id ? "..." : <Trash2 className="h-4 w-4" />}
                    </Button>
                  </div>
                  {/* LOVABLE:END actions */}
                </TableCell>
              </TableRow>
              {expandedId === row.id && (
                <TableRow>
                  <TableCell colSpan={9} className="p-0">
                    <RateationRowDetails row={row} onDataChanged={onDataChanged} />
                  </TableCell>
                </TableRow>
              )}
            </React.Fragment>
          ))}
        </TableBody>
      </Table>

      <EditRateationModal
        open={editId !== null}
        rateationId={editId}
        onOpenChange={(open) => !open && setEditId(null)}
        onSaved={() => { 
          onRefresh(); 
          onDataChanged?.(); 
        }}
      />
    </>
  );
}