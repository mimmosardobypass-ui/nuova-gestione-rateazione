import React from 'react';
import Flatpickr from 'react-flatpickr';
import { Italian } from 'flatpickr/dist/l10n/it.js';
import { cn } from '@/lib/utils';

type Props = {
  value?: string | Date | null;     // ISO 'YYYY-MM-DD' o Date
  onChange: (date: Date | null) => void;
  minDate?: Date;
  maxDate?: Date;
  disabled?: boolean;
  className?: string;
};

function toDate(v?: string | Date | null): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  // accettiamo ISO YYYY-MM-DD
  const d = new Date(`${v}T00:00:00`);
  return isNaN(d.getTime()) ? null : d;
}

export function DateCellPickerFlat({
  value,
  onChange,
  minDate,
  maxDate,
  disabled,
  className,
}: Props) {
  const date = toDate(value);

  return (
    <Flatpickr
      value={date || undefined}
      options={{
        locale: Italian,
        dateFormat: 'd/m/Y',       // formato visualizzato
        allowInput: true,          // scrittura manuale
        monthSelectorType: 'dropdown', // dropdown Month/Year
        static: false,
        appendTo: document.body,   // evita clipping nei dialog
        disableMobile: true,       // forza il calendario desktop anche su mobile
        minDate,
        maxDate,
      }}
      onChange={(selected) => {
        // Flatpickr passa Date[]; prendiamo la prima
        const d = selected?.[0] ?? null;
        onChange(d ?? null);
      }}
      className={cn(
        'w-[120px] h-8 px-2 py-1 text-sm border border-input bg-background rounded-md',
        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      disabled={!!disabled}
      placeholder="dd/MM/yyyy"
    />
  );
}