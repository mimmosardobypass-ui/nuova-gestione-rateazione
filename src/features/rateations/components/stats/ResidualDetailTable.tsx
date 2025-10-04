import { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { formatEuroFromCents } from '@/lib/formatters';
import { loadResidualPrefs, saveResidualPrefs } from '../../utils/statsFilters';
import type { ResidualDetailRow } from '../../types/stats';

interface ResidualDetailTableProps {
  rows: ResidualDetailRow[];
}

const TYPE_ORDER = ['F24', 'PagoPA', 'Rottamazione Quater', 'Riam. Quater', 'Altro'];

export function ResidualDetailTable({ rows }: ResidualDetailTableProps) {
  const [groupByType, setGroupByType] = useState(loadResidualPrefs().groupByType);

  useEffect(() => {
    saveResidualPrefs({ groupByType });
  }, [groupByType]);

  const total = rows.reduce((sum, r) => sum + (r.residual_amount_cents || 0), 0);

  if (!rows?.length) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Nessun dato disponibile con i filtri selezionati
      </div>
    );
  }

  if (!groupByType) {
    // Layout A - elenco unico
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Switch
            checked={groupByType}
            onCheckedChange={setGroupByType}
            id="groupByType"
          />
          <Label htmlFor="groupByType" className="text-sm cursor-pointer">
            Raggruppa per tipologia
          </Label>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Numero</TableHead>
              <TableHead>Contribuente</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Stato</TableHead>
              <TableHead>Creato il</TableHead>
              <TableHead className="text-right">Residuo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.number}</TableCell>
                <TableCell>{r.taxpayer_name ?? '—'}</TableCell>
                <TableCell>{r.type_label}</TableCell>
                <TableCell>{r.status}</TableCell>
                <TableCell>{new Date(r.created_at).toLocaleDateString('it-IT')}</TableCell>
                <TableCell className="text-right font-medium">
                  {formatEuroFromCents(r.residual_amount_cents)}
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="font-semibold bg-muted/40">
              <TableCell colSpan={5}>TOTALE</TableCell>
              <TableCell className="text-right">{formatEuroFromCents(total)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    );
  }

  // Layout B - raggruppato per tipologia con sub-totali
  const groups = rows.reduce<Record<string, ResidualDetailRow[]>>((acc, r) => {
    (acc[r.type_label] ||= []).push(r);
    return acc;
  }, {});

  const sortedGroups = Object.entries(groups).sort(
    ([a], [b]) => TYPE_ORDER.indexOf(a) - TYPE_ORDER.indexOf(b)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Switch
          checked={groupByType}
          onCheckedChange={setGroupByType}
          id="groupByType"
        />
        <Label htmlFor="groupByType" className="text-sm cursor-pointer">
          Raggruppa per tipologia
        </Label>
      </div>
      
      {sortedGroups.map(([type, list]) => {
        const subTotal = list.reduce((sum, r) => sum + (r.residual_amount_cents || 0), 0);
        return (
          <div key={type} className="space-y-2">
            <div className="text-sm font-semibold text-foreground">{type}</div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numero</TableHead>
                  <TableHead>Contribuente</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Creato il</TableHead>
                  <TableHead className="text-right">Residuo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.number}</TableCell>
                    <TableCell>{r.taxpayer_name ?? '—'}</TableCell>
                    <TableCell>{r.status}</TableCell>
                    <TableCell>{new Date(r.created_at).toLocaleDateString('it-IT')}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatEuroFromCents(r.residual_amount_cents)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-medium bg-muted/30">
                  <TableCell colSpan={4}>Sub-totale {type}</TableCell>
                  <TableCell className="text-right">{formatEuroFromCents(subTotal)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        );
      })}
      
      <div className="text-right text-base font-semibold pt-2 border-t">
        TOTALE GENERALE: {formatEuroFromCents(total)}
      </div>
    </div>
  );
}
