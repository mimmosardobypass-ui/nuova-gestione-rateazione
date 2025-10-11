import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import type { StatsFilters } from "../../types/stats";

interface StatsFiltersProps {
  filters: StatsFilters;
  onApply: (filters: StatsFilters) => void;
  onReset: () => void;
}

const TYPE_OPTIONS = ['F24', 'PagoPA', 'Rottamazione Quater', 'Riam. Quater', 'Altro'];
// Normalizzati in lowercase per coerenza con RPC UPPER()
const STATUS_OPTIONS = ['attiva', 'in_ritardo', 'completata', 'decaduta', 'interrotta'];

export function StatsFiltersComponent({ filters, onApply, onReset }: StatsFiltersProps) {
  const [local, setLocal] = useState<StatsFilters>(filters);

  const handleTypeToggle = (type: string) => {
    const current = local.typeLabels || [];
    const updated = current.includes(type)
      ? current.filter(t => t !== type)
      : [...current, type];
    setLocal({ ...local, typeLabels: updated.length > 0 ? updated : null });
  };

  const handleStatusToggle = (status: string) => {
    const current = local.statuses || [];
    const updated = current.includes(status)
      ? current.filter(s => s !== status)
      : [...current, status];
    setLocal({ ...local, statuses: updated.length > 0 ? updated : null });
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Data Inizio</Label>
          <Input
            type="date"
            value={local.startDate}
            onChange={(e) => setLocal({ ...local, startDate: e.target.value })}
          />
        </div>
        <div>
          <Label>Data Fine</Label>
          <Input
            type="date"
            value={local.endDate}
            onChange={(e) => setLocal({ ...local, endDate: e.target.value })}
          />
        </div>
      </div>

      <div>
        <Label>Tipologia</Label>
        <div className="flex flex-wrap gap-2 mt-2">
          {TYPE_OPTIONS.map(type => (
            <div key={type} className="flex items-center space-x-2">
              <Checkbox
                id={`type-${type}`}
                checked={(local.typeLabels || []).includes(type)}
                onCheckedChange={() => handleTypeToggle(type)}
              />
              <label htmlFor={`type-${type}`} className="text-sm cursor-pointer">
                {type}
              </label>
            </div>
          ))}
        </div>
      </div>

      <div>
        <Label>Stato</Label>
        <div className="flex flex-wrap gap-2 mt-2">
          {STATUS_OPTIONS.map(status => (
            <div key={status} className="flex items-center space-x-2">
              <Checkbox
                id={`status-${status}`}
                checked={(local.statuses || []).includes(status)}
                onCheckedChange={() => handleStatusToggle(status)}
              />
              <label htmlFor={`status-${status}`} className="text-sm cursor-pointer">
                {status}
              </label>
            </div>
          ))}
        </div>
      </div>

      <div>
        <Label>Contribuente (ricerca)</Label>
        <Input
          type="text"
          placeholder="Cerca per nome contribuente..."
          value={local.taxpayerSearch || ''}
          onChange={(e) => setLocal({ ...local, taxpayerSearch: e.target.value || null })}
        />
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="owner-only"
          checked={local.ownerOnly}
          onCheckedChange={(checked) => setLocal({ ...local, ownerOnly: !!checked })}
        />
        <label htmlFor="owner-only" className="text-sm cursor-pointer">
          Solo mie pratiche
        </label>
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="include-closed"
          checked={local.includeClosed}
          onCheckedChange={(checked) => setLocal({ ...local, includeClosed: !!checked })}
        />
        <label htmlFor="include-closed" className="text-sm cursor-pointer">
          Includi interrotte/estinte
        </label>
      </div>

      <div className="flex gap-2">
        <Button onClick={() => onApply(local)}>Applica Filtri</Button>
        <Button variant="outline" onClick={onReset}>Reset</Button>
      </div>
    </Card>
  );
}
