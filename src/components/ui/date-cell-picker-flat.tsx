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
  const d = new Date(`${v}T00:00:00`);
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
  const portalRef = React.useRef<HTMLDivElement | null>(null);
  const stopRef = React.useRef<(e: MouseEvent) => void>();

  React.useEffect(() => {
    const div = document.createElement("div");
    div.setAttribute("id", "flatpickr-portal");
    // importante: layer dedicato
    div.style.position = "relative";
    div.style.zIndex = "2147483647";
    document.body.appendChild(div);
    portalRef.current = div;
    return () => div.remove();
  }, []);

  return (
    <Flatpickr
      value={date}
      onChange={(sel) => onChange(sel?.[0] ?? null)}
      options={{
        locale: Italian,
        dateFormat: "d/m/Y",
        disableMobile: true,
        // dropdown nativi per mese/anno (come da richiesta)
        monthSelectorType: "dropdown",
        // posizionamento intelligente
        position: "auto center",
        appendTo: portalRef.current ?? document.body,
        minDate: minDate ?? undefined,
        maxDate: maxDate ?? undefined,
        clickOpens: true,

        // evita che i click sui controlli del calendario chiudano/riposizionino il popover
        onOpen: (_d, _s, fp) => {
          const stop = (e: MouseEvent) => e.stopPropagation();
          stopRef.current = stop;
          // cattura molto presto per bloccare qualsiasi "click away"
          fp.calendarContainer.addEventListener("mousedown", stop, { capture: true });
          fp.calendarContainer.addEventListener("click", stop, { capture: true });
        },
        onClose: (_d, _s, fp) => {
          if (stopRef.current) {
            fp.calendarContainer.removeEventListener("mousedown", stopRef.current, { capture: true } as any);
            fp.calendarContainer.removeEventListener("click", stopRef.current, { capture: true } as any);
          }
        },

        // micro-aggiustamento posizione per non uscire dallo schermo
        onPreCalendarPosition: (_: any, __: any, fp: any) => {
          const cal = fp.calendarContainer as HTMLElement;
          const rect = cal.getBoundingClientRect();
          const vw = window.innerWidth;
          const vh = window.innerHeight;
          // centra se necessario
          if (rect.right > vw) cal.style.left = `${Math.max(8, vw - rect.width - 8)}px`;
          if (rect.bottom > vh) cal.style.top = `${Math.max(8, vh - rect.height - 8)}px`;
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
    />
  );
}