import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRateationTypes } from "@/features/rateations/hooks/useRateationTypes";
import { FilterX } from "lucide-react";

interface RateationFiltersProps {
  onComparazione: () => void;
  onStats: () => void;
  onDeadlines: () => void;
  filters: {
    tipo: string;
    stato: string;
    mese: string;
    anno: string;
  };
  onFilterChange: (key: string, value: string) => void;
  onResetFilters: () => void;
}

export function RateationFilters({ 
  onComparazione, 
  onStats, 
  onDeadlines,
  filters,
  onFilterChange,
  onResetFilters
}: RateationFiltersProps) {
  const { types, loading: typesLoading } = useRateationTypes();
  
  // Conta i filtri attivi
  const activeFiltersCount = Object.entries(filters).filter(([key, value]) => 
    value !== 'all' && value !== ''
  ).length;

  return (
    <Card className="mb-6">
      <CardContent className="pt-6">
        {/* LOVABLE:START filterControls */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <Select 
              value={filters.tipo} 
              onValueChange={(val) => onFilterChange('tipo', val)}
              disabled={typesLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Tutti i tipi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti i tipi</SelectItem>
                {types.map(tipo => (
                  <SelectItem key={tipo.id} value={tipo.name}>
                    {tipo.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Select 
              value={filters.stato} 
              onValueChange={(val) => onFilterChange('stato', val)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Tutti gli stati" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti gli stati</SelectItem>
                <SelectItem value="active">Attiva</SelectItem>
                <SelectItem value="late">In ritardo</SelectItem>
                <SelectItem value="completed">Completata</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Input 
              type="month" 
              placeholder="Mese"
              value={filters.mese}
              onChange={(e) => onFilterChange('mese', e.target.value)}
            />
          </div>
          <div>
            <Input 
              type="number" 
              placeholder="Anno" 
              min="2020" 
              max="2030"
              value={filters.anno}
              onChange={(e) => onFilterChange('anno', e.target.value)}
            />
          </div>
        </div>
        {/* LOVABLE:END filterControls */}

        {/* LOVABLE:START actionButtons */}
        <div className="flex gap-2 flex-wrap items-center">
          <Button variant="outline" onClick={onComparazione}>
            Comparazione annuale
          </Button>
          <Button variant="outline" onClick={onDeadlines}>
            Scadenze
          </Button>
          <Button variant="outline" onClick={onStats}>
            Statistiche
          </Button>
          
          {activeFiltersCount > 0 && (
            <>
              <div className="h-4 w-px bg-border" />
              <Button 
                variant="ghost" 
                size="sm"
                onClick={onResetFilters}
                className="gap-2"
              >
                <FilterX className="h-4 w-4" />
                Reset filtri
                <Badge variant="secondary" className="ml-1">
                  {activeFiltersCount}
                </Badge>
              </Button>
            </>
          )}
        </div>
        {/* LOVABLE:END actionButtons */}
      </CardContent>
    </Card>
  );
}