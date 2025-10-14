import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import type { StatsV3Filters } from "../../hooks/useStatsV3";

interface StatsV3FiltersProps {
  filters: StatsV3Filters;
  onApply: (filters: StatsV3Filters) => void;
  onReset: () => void;
}

const AVAILABLE_TYPES = ["F24", "PAGOPA", "RIAMMISSIONE_QUATER", "ALTRO"];
const AVAILABLE_STATUSES = ["attiva", "completata", "interrotta", "decaduta", "estinta"];

const TYPE_LABELS: Record<string, string> = {
  F24: "F24",
  PAGOPA: "PagoPA",
  RIAMMISSIONE_QUATER: "Riammissione Quater",
  ALTRO: "Altro",
};

const STATUS_LABELS: Record<string, string> = {
  attiva: "Attiva",
  completata: "Completata",
  interrotta: "Interrotta",
  decaduta: "Decaduta",
  estinta: "Estinta",
};

export function StatsV3Filters({ filters, onApply, onReset }: StatsV3FiltersProps) {
  const [localFilters, setLocalFilters] = useState<StatsV3Filters>(filters);

  const handleTypeToggle = (type: string) => {
    const currentTypes = localFilters.types || [];
    const newTypes = currentTypes.includes(type)
      ? currentTypes.filter((t) => t !== type)
      : [...currentTypes, type];
    
    setLocalFilters({ ...localFilters, types: newTypes.length > 0 ? newTypes : null });
  };

  const handleStatusToggle = (status: string) => {
    const currentStatuses = localFilters.statuses || [];
    const newStatuses = currentStatuses.includes(status)
      ? currentStatuses.filter((s) => s !== status)
      : [...currentStatuses, status];
    
    setLocalFilters({ ...localFilters, statuses: newStatuses.length > 0 ? newStatuses : null });
  };

  return (
    <Card className="mb-6">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-lg font-semibold">🔍 Filtri Avanzati</CardTitle>
        <Button variant="outline" size="sm" onClick={onReset}>
          Reset
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tipologie */}
        <div>
          <Label className="text-sm font-medium mb-2 block">Tipologia</Label>
          <div className="flex flex-wrap gap-3">
            {AVAILABLE_TYPES.map((type) => (
              <div key={type} className="flex items-center space-x-2">
                <Checkbox
                  id={`type-${type}`}
                  checked={(localFilters.types || []).includes(type)}
                  onCheckedChange={() => handleTypeToggle(type)}
                />
                <Label
                  htmlFor={`type-${type}`}
                  className="text-sm font-normal cursor-pointer"
                >
                  {TYPE_LABELS[type]}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Stati */}
        <div>
          <Label className="text-sm font-medium mb-2 block">Stato</Label>
          <div className="flex flex-wrap gap-3">
            {AVAILABLE_STATUSES.map((status) => (
              <div key={status} className="flex items-center space-x-2">
                <Checkbox
                  id={`status-${status}`}
                  checked={(localFilters.statuses || []).includes(status)}
                  onCheckedChange={() => handleStatusToggle(status)}
                />
                <Label
                  htmlFor={`status-${status}`}
                  className="text-sm font-normal cursor-pointer"
                >
                  {STATUS_LABELS[status]}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Periodo */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="dateFrom" className="text-sm font-medium mb-2 block">
              Data Inizio
            </Label>
            <Input
              id="dateFrom"
              type="date"
              value={localFilters.dateFrom || ""}
              onChange={(e) =>
                setLocalFilters({ ...localFilters, dateFrom: e.target.value || null })
              }
            />
          </div>
          <div>
            <Label htmlFor="dateTo" className="text-sm font-medium mb-2 block">
              Data Fine
            </Label>
            <Input
              id="dateTo"
              type="date"
              value={localFilters.dateTo || ""}
              onChange={(e) =>
                setLocalFilters({ ...localFilters, dateTo: e.target.value || null })
              }
            />
          </div>
        </div>

        {/* Opzioni */}
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="includeInterrupted"
              checked={localFilters.includeInterrupted}
              onCheckedChange={(checked) =>
                setLocalFilters({ ...localFilters, includeInterrupted: !!checked })
              }
            />
            <Label htmlFor="includeInterrupted" className="text-sm font-normal cursor-pointer">
              Includi interrotte
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="includeDecayed"
              checked={localFilters.includeDecayed}
              onCheckedChange={(checked) =>
                setLocalFilters({ ...localFilters, includeDecayed: !!checked })
              }
            />
            <Label htmlFor="includeDecayed" className="text-sm font-normal cursor-pointer">
              Includi decadute
            </Label>
          </div>
        </div>

        {/* Apply Button */}
        <div className="pt-2">
          <Button onClick={() => onApply(localFilters)} className="w-full md:w-auto">
            Applica Filtri
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
