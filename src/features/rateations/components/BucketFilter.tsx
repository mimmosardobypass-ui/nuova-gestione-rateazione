import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export type BucketValue = 'Tutte' | 'In ritardo' | 'Oggi' | 'Entro 7 giorni' | 'Entro 30 giorni' | 'Futuro' | 'Pagata';

const BUCKET_OPTIONS: { value: BucketValue; label: string }[] = [
  { value: 'Tutte', label: 'Tutte le scadenze' },
  { value: 'In ritardo', label: 'In ritardo' },
  { value: 'Oggi', label: 'Scadono oggi' },
  { value: 'Entro 7 giorni', label: 'Entro 7 giorni' },
  { value: 'Entro 30 giorni', label: 'Entro 30 giorni' },
  { value: 'Futuro', label: 'Future' },
  { value: 'Pagata', label: 'Pagate' },
];

interface BucketFilterProps {
  value: BucketValue;
  onChange: (value: BucketValue) => void;
}

export function BucketFilter({ value, onChange }: BucketFilterProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">
        Stato scadenza
      </label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Seleziona stato" />
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
  );
}