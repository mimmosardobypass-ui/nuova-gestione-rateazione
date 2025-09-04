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
  return Number.isFinite(d.getTime()) ? d : null;
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
      value={date ?? undefined}
      options={{
        // *** NON blocchiamo la navigazione se non servono limiti ***
        minDate: minDate ?? undefined,
        maxDate: maxDate ?? undefined,
        
        // UX
        dateFormat: 'd/m/Y',
        defaultDate: date ?? undefined,
        allowInput: true,
        disableMobile: true,
        static: false,
        appendTo: document.body, // evita stacking sotto al Dialog
        locale: Italian,
        monthSelectorType: 'dropdown', // dropdown mese/anno
      }}
      onChange={(selected: Date[]) => onChange(selected?.[0] ?? null)}
      className={[
        'w-[120px] h-8 px-2 py-1 text-sm border border-input bg-background rounded-md',
        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className || '',
      ].join(' ')}
      placeholder="dd/MM/yyyy"
      disabled={!!disabled}
    />
  );
}