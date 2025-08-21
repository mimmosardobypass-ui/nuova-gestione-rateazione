import React from 'react';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Skeleton } from '@/components/ui/skeleton';

export type PayFilterValue = 'unpaid' | 'paid' | 'all';

interface SegmentedPayFilterProps {
  value: PayFilterValue;
  onChange: (value: PayFilterValue) => void;
  counts: { unpaid: number; paid: number; total: number };
  loading?: boolean;
}

export function SegmentedPayFilter({ 
  value, 
  onChange, 
  counts, 
  loading = false 
}: SegmentedPayFilterProps) {
  return (
    <div className="flex justify-center">
      <ToggleGroup 
        type="single" 
        value={value} 
        onValueChange={(v) => v && onChange(v as PayFilterValue)}
        className="grid w-full grid-cols-3 gap-1"
      >
        <ToggleGroupItem 
          value="unpaid" 
          className="flex items-center gap-2 px-3 py-2 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          <span>Da pagare</span>
          {loading ? (
            <Skeleton className="h-5 w-6" />
          ) : (
            <Badge 
              variant="secondary" 
              className="bg-background text-foreground border"
            >
              {counts.unpaid}
            </Badge>
          )}
        </ToggleGroupItem>
        
        <ToggleGroupItem 
          value="paid" 
          className="flex items-center gap-2 px-3 py-2 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          <span>Pagate</span>
          {loading ? (
            <Skeleton className="h-5 w-6" />
          ) : (
            <Badge 
              variant="secondary" 
              className="bg-background text-foreground border"
            >
              {counts.paid}
            </Badge>
          )}
        </ToggleGroupItem>
        
        <ToggleGroupItem 
          value="all" 
          className="flex items-center gap-2 px-3 py-2 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          <span>Tutte</span>
          {loading ? (
            <Skeleton className="h-5 w-6" />
          ) : (
            <Badge 
              variant="secondary" 
              className="bg-background text-foreground border"
            >
              {counts.total}
            </Badge>
          )}
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}