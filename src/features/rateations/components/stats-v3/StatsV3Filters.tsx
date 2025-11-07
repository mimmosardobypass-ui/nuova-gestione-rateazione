import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
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
  attiva: "Attiva (incl. in ritardo)",
  completata: "Completata",
  interrotta: "Interrotta",
  decaduta: "Decaduta",
  estinta: "Estinta",
};

export function StatsV3Filters({ filters, onApply, onReset }: StatsV3FiltersProps) {
  const [localFilters, setLocalFilters] = useState<StatsV3Filters>(filters);
  const [loadingRange, setLoadingRange] = useState(false);

  const handleQuickRange = async (range: string) => {
    setLoadingRange(true);
    const today = new Date();
    let dateFrom: string | null = null;
    let dateTo: string | null = null;

    try {
      switch(range) {
        case 'last12':
          dateFrom = new Date(today.getFullYear(), today.getMonth() - 12, 1)
            .toISOString().split('T')[0];
          dateTo = today.toISOString().split('T')[0];
          break;
        case 'thisYear':
          dateFrom = `${today.getFullYear()}-01-01`;
          dateTo = `${today.getFullYear()}-12-31`;
          break;
        case 'last2Years':
          dateFrom = `${today.getFullYear() - 2}-01-01`;
          dateTo = today.toISOString().split('T')[0];
          break;
        case 'all':
          const { data: minData } = await supabase
            .from('v_rateation_installments')
            .select('due_date')
            .order('due_date', { ascending: true })
            .limit(1);
          
          const { data: maxData } = await supabase
            .from('v_rateation_installments')
            .select('due_date')
            .order('due_date', { ascending: false })
            .limit(1);
          
          dateFrom = minData?.[0]?.due_date || null;
          dateTo = maxData?.[0]?.due_date || null;
          break;
      }

      const newFilters = { ...localFilters, dateFrom, dateTo };
      setLocalFilters(newFilters);
      onApply(newFilters);
    } finally {
      setLoadingRange(false);
    }
  };

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
        <div>
          <Label className="text-sm font-medium mb-2 block">Periodo</Label>
          
          {/* Range Rapidi */}
          <div className="flex flex-wrap gap-2 mb-3">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handleQuickRange('last12')}
              disabled={loadingRange}
            >
              Ultimi 12 mesi
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handleQuickRange('thisYear')}
              disabled={loadingRange}
            >
              Anno corrente
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handleQuickRange('last2Years')}
              disabled={loadingRange}
            >
              Ultimi 2 anni
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handleQuickRange('all')}
              disabled={loadingRange}
            >
              📊 Tutto il periodo
            </Button>
          </div>

          {/* Indicatore Range Attivo */}
          {localFilters.dateFrom && localFilters.dateTo && (
            <div className="text-xs text-muted-foreground mb-3 px-2 py-1 bg-muted/30 rounded">
              📅 Range: {new Date(localFilters.dateFrom).toLocaleDateString('it-IT')} - {new Date(localFilters.dateTo).toLocaleDateString('it-IT')}
            </div>
          )}

          {/* Date Personalizzate */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="dateFrom" className="text-sm font-medium mb-2 block">
                Data Inizio (personalizzata)
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
                Data Fine (personalizzata)
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
        </div>

        {/* Opzioni */}
        <div className="flex flex-col gap-4">
          {/* Raggruppa per */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Raggruppa rate per</Label>
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="groupByDue"
                  checked={localFilters.groupBy === 'due'}
                  onCheckedChange={(checked) => {
                    if (checked) setLocalFilters({ ...localFilters, groupBy: 'due' });
                  }}
                />
                <Label htmlFor="groupByDue" className="text-sm font-normal cursor-pointer">
                  📅 Per scadenza (default)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="groupByPaid"
                  checked={localFilters.groupBy === 'paid'}
                  onCheckedChange={(checked) => {
                    if (checked) setLocalFilters({ ...localFilters, groupBy: 'paid' });
                  }}
                />
                <Label htmlFor="groupByPaid" className="text-sm font-normal cursor-pointer">
                  💰 Per pagamento effettivo
                </Label>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5 px-2">
              {localFilters.groupBy === 'due' 
                ? "Le rate vengono raggruppate per data di scadenza prevista (pianificazione fiscale)"
                : "Le rate vengono raggruppate per data di pagamento effettivo (riconciliazione bancaria)"}
            </p>
          </div>

          {/* Altri filtri */}
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
