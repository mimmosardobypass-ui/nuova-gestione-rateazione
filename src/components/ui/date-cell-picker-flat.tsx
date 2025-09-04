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
  // supporta ISO YYYY-MM-DD
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

  // contenitore "sicuro" per evitare clipping/overlay dei Dialog
  React.useEffect(() => {
    const div = document.createElement("div");
    div.setAttribute("id", "flatpickr-portal");
    document.body.appendChild(div);
    portalRef.current = div;
    return () => {
      div.remove();
    };
  }, []);

  return (
    <Flatpickr
      value={date}
      onChange={(selected) => onChange(selected?.[0] ?? null)}
      options={{
        // identico allo screen: select a tendina per mese e anno + frecce
        monthSelectorType: "dropdown",
        // locale IT
        locale: Italian,
        // formato inserimento/visualizzazione
        dateFormat: "d/m/Y",
        // click sempre sul calendario custom (anche su mobile)
        disableMobile: true,
        // append al body per non essere tagliato dai container con overflow
        appendTo: portalRef.current ?? document.body,
        // limiti opzionali
        minDate: minDate ?? undefined,
        maxDate: maxDate ?? undefined,
        // assicurati che si apra sempre con il click
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
    />
  );
}