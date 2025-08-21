import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BUCKET_OPTIONS, type BucketValue } from '@/features/rateations/constants/buckets';

export type BucketFilterValue = 'all' | BucketValue;

interface BucketFilterProps {
  value: BucketFilterValue;
  onChange: (value: BucketFilterValue) => void;
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