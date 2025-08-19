import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Filter } from 'lucide-react';
import { format, addDays, startOfMonth, endOfMonth, addMonths } from 'date-fns';
import { it } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useRateationTypes } from '@/features/rateations/hooks/useRateationTypes';
import type { DeadlineFilters } from '@/features/rateations/hooks/useDeadlines';

interface DeadlineFiltersProps {
  filters: DeadlineFilters;
  onFiltersChange: (filters: DeadlineFilters) => void;
}

const PRESET_PERIODS = [
  { label: 'Oggi', getValue: () => {
    const today = new Date();
    return { startDate: format(today, 'yyyy-MM-dd'), endDate: format(today, 'yyyy-MM-dd') };
  }},
  { label: 'Questa settimana', getValue: () => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + 1); // Monday
    const endOfWeek = addDays(startOfWeek, 6);
    return { startDate: format(startOfWeek, 'yyyy-MM-dd'), endDate: format(endOfWeek, 'yyyy-MM-dd') };
  }},
  { label: 'Questo mese', getValue: () => {
    const today = new Date();
    return { 
      startDate: format(startOfMonth(today), 'yyyy-MM-dd'), 
      endDate: format(endOfMonth(today), 'yyyy-MM-dd') 
    };
  }},
  { label: 'Prossimi 30 giorni', getValue: () => {
    const today = new Date();
    const end = addDays(today, 30);
    return { startDate: format(today, 'yyyy-MM-dd'), endDate: format(end, 'yyyy-MM-dd') };
  }},
  { label: 'Prossimi 90 giorni', getValue: () => {
    const today = new Date();
    const end = addDays(today, 90);
    return { startDate: format(today, 'yyyy-MM-dd'), endDate: format(end, 'yyyy-MM-dd') };
  }},
  { label: 'Anno in corso', getValue: () => {
    const today = new Date();
    const startOfYear = new Date(today.getFullYear(), 0, 1);
    const endOfYear = new Date(today.getFullYear(), 11, 31);
    return { startDate: format(startOfYear, 'yyyy-MM-dd'), endDate: format(endOfYear, 'yyyy-MM-dd') };
  }},
];

const BUCKET_OPTIONS = [
  { value: 'Tutte', label: 'Tutte' },
  { value: 'In ritardo', label: 'In ritardo' },
  { value: 'Entro 7 giorni', label: 'Entro 7 giorni' },
  { value: 'Entro 30 giorni', label: 'Entro 30 giorni' },
  { value: 'Futuro', label: 'Futuro' },
];

export function DeadlineFilters({ filters, onFiltersChange }: DeadlineFiltersProps) {
  const { types: rateationTypes = [] } = useRateationTypes();
  const [startDate, setStartDate] = React.useState<Date | undefined>();
  const [endDate, setEndDate] = React.useState<Date | undefined>();

  const applyPreset = (preset: typeof PRESET_PERIODS[0]) => {
    const { startDate, endDate } = preset.getValue();
    onFiltersChange({ ...filters, startDate, endDate });
  };

  const applyDateRange = () => {
    if (startDate && endDate) {
      onFiltersChange({
        ...filters,
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd'),
      });
    }
  };

  const clearFilters = () => {
    onFiltersChange({});
    setStartDate(undefined);
    setEndDate(undefined);
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4" />
        <h3 className="font-semibold">Filtri Scadenze</h3>
      </div>

      {/* Periodo - Preset rapidi */}
      <div className="space-y-2">
        <Label>Periodo</Label>
        <div className="flex flex-wrap gap-1">
          {PRESET_PERIODS.map((preset) => (
            <Button
              key={preset.label}
              variant="outline"
              size="sm"
              onClick={() => applyPreset(preset)}
              className="text-xs"
            >
              {preset.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Range personalizzato */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Da</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal text-xs",
                  !startDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-3 w-3" />
                {startDate ? format(startDate, "dd/MM/yyyy") : "Seleziona"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={setStartDate}
                locale={it}
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">A</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal text-xs",
                  !endDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-3 w-3" />
                {endDate ? format(endDate, "dd/MM/yyyy") : "Seleziona"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={setEndDate}
                locale={it}
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <Button
        variant="secondary"
        size="sm"
        onClick={applyDateRange}
        disabled={!startDate || !endDate}
        className="w-full"
      >
        Applica Range
      </Button>

      {/* Tipo rateazione */}
      <div className="space-y-2">
        <Label>Tipo</Label>
        <Select
          value={filters.typeIds?.join(',') || ''}
          onValueChange={(value) => {
            if (value) {
              onFiltersChange({ 
                ...filters, 
                typeIds: value.split(',').map(Number) 
              });
            } else {
              onFiltersChange({ ...filters, typeIds: undefined });
            }
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Tutti i tipi" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Tutti i tipi</SelectItem>
            {rateationTypes.map((type) => (
              <SelectItem key={type.id} value={type.id.toString()}>
                {type.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stato/Bucket */}
      <div className="space-y-2">
        <Label>Stato</Label>
        <Select
          value={filters.bucket || 'Tutte'}
          onValueChange={(value) => 
            onFiltersChange({ ...filters, bucket: value === 'Tutte' ? undefined : value })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BUCKET_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Ricerca */}
      <div className="space-y-2">
        <Label>Cerca</Label>
        <Input
          placeholder="Numero o contribuente..."
          value={filters.search || ''}
          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
        />
      </div>

      <Button variant="outline" onClick={clearFilters} className="w-full">
        Pulisci Filtri
      </Button>
    </Card>
  );
}