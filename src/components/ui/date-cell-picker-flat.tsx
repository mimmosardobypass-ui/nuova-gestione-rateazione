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

function toDate(v?: string | Date | null): Date | null {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  const d = new Date(`${v}T00:00:00`); // ISO "YYYY-MM-DD"
  return isNaN(d.getTime()) ? null : d;
}

export default function DateCellPickerFlat({
  value,
  onChange,
  minDate,
  maxDate,
  disabled,
  className,
}: Props) {
  const date = toDate(value) || undefined;

  // Portal per evitare clipping / z-index issues
  const portalRef = React.useRef<HTMLDivElement | null>(null);
  const fpInstance = React.useRef<any>(null);
  const stopRef = React.useRef<(e: MouseEvent) => void>();

  React.useEffect(() => {
    const div = document.createElement("div");
    div.id = "flatpickr-portal";
    div.style.position = "relative";
    div.style.zIndex = "2147483647";
    document.body.appendChild(div);
    portalRef.current = div;
    return () => div.remove();
  }, []);

  const openCalendar = () => {
    // fallback sicuro: apri manualmente
    try {
      (fpInstance.current as any)?.open?.();
    } catch {}
  };

  return (
    <div className="relative flex items-center gap-1">
      <Flatpickr
        value={date}
        onChange={(sel) => onChange(sel?.[0] ?? null)}
        options={{
          locale: Italian,
          dateFormat: "d/m/Y",
          disableMobile: true,
          monthSelectorType: "dropdown",          // menu a tendina mese/anno
          position: "auto center",
          appendTo: portalRef.current ?? document.body,
          minDate: minDate ?? undefined,
          maxDate: maxDate ?? undefined,
          clickOpens: true,
          onReady: (_d, _s, instance) => {
            fpInstance.current = instance;
          },
          // Evita che i click sui controlli chiudano o riposizionino il popover
          onOpen: (_d, _s, fp) => {
            const stop = (e: MouseEvent) => e.stopPropagation();
            stopRef.current = stop;
            fp.calendarContainer.addEventListener("mousedown", stop, { capture: true });
            fp.calendarContainer.addEventListener("click", stop, { capture: true });
          },
          onClose: (_d, _s, fp) => {
            if (stopRef.current) {
              fp.calendarContainer.removeEventListener("mousedown", stopRef.current, { capture: true } as any);
              fp.calendarContainer.removeEventListener("click", stopRef.current, { capture: true } as any);
            }
          },
        }}
        placeholder="dd/MM/yyyy"
        className={[
          "w-[120px] h-8 px-2 py-1 text-sm border border-input bg-background rounded-md",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className || "",
        ].join(" ")}
        disabled={!!disabled}
        // In alcuni layout il click non innesca l'open → forziamo noi
        onFocus={openCalendar}
        onClick={openCalendar}
      />
      {/* pulsante icona di sicurezza */}
      <button
        type="button"
        aria-label="Apri calendario"
        onClick={openCalendar}
        disabled={!!disabled}
        className="h-8 w-8 rounded-md border border-input text-gray-600 hover:bg-accent/50 disabled:opacity-50"
      >
        📅
      </button>
    </div>
  );
}