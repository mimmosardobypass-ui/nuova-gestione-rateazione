import React from "react";
import Flatpickr from "react-flatpickr";
import { Italian } from "flatpickr/dist/l10n/it.js";
import "flatpickr/dist/flatpickr.min.css";
import "flatpickr/dist/themes/material_blue.css";

type Props = {
  value?: string | Date | null;
  onChange: (d: Date | null) => void;
  minDate?: Date;
  maxDate?: Date;
  disabled?: boolean;
  className?: string;
};

function toDate(v?: string | Date | null): Date | undefined {
  if (!v) return undefined;
  if (v instanceof Date) return isNaN(v.getTime()) ? undefined : v;
  // ISO YYYY-MM-DD
  const d = new Date(`${v}T00:00:00`);
  return isNaN(d.getTime()) ? undefined : d;
}

export default function DateCellPickerFlat({
  value,
  onChange,
  minDate,
  maxDate,
  disabled,
  className,
}: Props) {
  const fpRef = React.useRef<any>(null);
  const date = toDate(value);

  const open = React.useCallback(() => {
    if (disabled) return;
    fpRef.current?.flatpickr?.open?.();
  }, [disabled]);

  return (
    <div className="flex items-center gap-1">
      <Flatpickr
        ref={fpRef}
        value={date}
        onChange={(sel) => onChange(sel?.[0] ?? null)}
        options={{
          locale: Italian,
          dateFormat: "d/m/Y",
          disableMobile: true,
          allowInput: true,              // scrittura manuale dd/mm/yyyy
          monthSelectorType: "dropdown", // menu a tendina mese/anno
          position: "auto center",
          appendTo: document.body,       // niente portal custom
          minDate: minDate ?? undefined,
          maxDate: maxDate ?? undefined,
          clickOpens: true,
        }}
        placeholder="dd/MM/yyyy"
        className={[
          "w-[120px] h-8 px-2 py-1 text-sm border border-input bg-background rounded-md",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className || "",
        ].join(" ")}
        disabled={!!disabled}
        // Evita che la riga della tabella "ingoi" il click
        onClick={(e) => { e.stopPropagation(); open(); }}
        onFocus={(e) => { e.stopPropagation(); open(); }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
        }}
      />
      <button
        type="button"
        aria-label="Apri calendario"
        onClick={(e) => { e.stopPropagation(); open(); }}
        className="ml-1 inline-flex items-center justify-center h-8 w-8 rounded-md border"
        disabled={!!disabled}
      >
        📅
      </button>
    </div>
  );
}