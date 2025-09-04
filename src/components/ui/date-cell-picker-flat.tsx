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
  const stopRef = React.useRef<Set<(e: Event) => void>>(new Set());
  const uniqueId = React.useRef(`flatpickr-portal-${Math.random().toString(36).substr(2, 9)}`);

  React.useEffect(() => {
    // Remove existing portal with same ID if any
    const existing = document.getElementById(uniqueId.current);
    if (existing) existing.remove();
    
    const div = document.createElement("div");
    div.id = uniqueId.current;
    div.style.position = "fixed";
    div.style.top = "0";
    div.style.left = "0";
    div.style.zIndex = "2147483647";
    div.style.pointerEvents = "none";
    document.body.appendChild(div);
    portalRef.current = div;
    
    return () => {
      const portal = document.getElementById(uniqueId.current);
      if (portal) portal.remove();
    };
  }, []);

  const openCalendar = React.useCallback(() => {
    if (disabled) return;
    
    try {
      const instance = fpInstance.current;
      if (instance) {
        // Force open with positioning
        instance.open();
        
        // Ensure calendar is positioned correctly
        setTimeout(() => {
          const calendar = instance.calendarContainer;
          if (calendar) {
            calendar.style.zIndex = "2147483647";
            calendar.style.pointerEvents = "auto";
            calendar.style.position = "absolute";
          }
        }, 0);
      }
    } catch (error) {
      console.warn("Failed to open calendar:", error);
    }
  }, [disabled]);

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
            
            // Ensure immediate accessibility
            if (instance.calendarContainer) {
              instance.calendarContainer.style.zIndex = "2147483647";
              instance.calendarContainer.style.pointerEvents = "auto";
            }
          },
          onPreCalendarPosition: (_d, _s, fp) => {
            // Ensure positioning doesn't break
            fp.calendarContainer.style.zIndex = "2147483647";
            fp.calendarContainer.style.pointerEvents = "auto";
            return true;
          },
          // Evita che i click sui controlli chiudano o riposizionino il popover
          onOpen: (_d, _s, fp) => {
            const events = ['mousedown', 'click', 'touchstart', 'touchend', 'keydown'];
            const handlers = new Set<(e: Event) => void>();
            
            events.forEach(eventType => {
              const handler = (e: Event) => {
                e.stopPropagation();
                e.stopImmediatePropagation();
              };
              handlers.add(handler);
              fp.calendarContainer.addEventListener(eventType, handler, { capture: true, passive: false });
            });
            
            stopRef.current = handlers;
            
            // Force correct styling
            fp.calendarContainer.style.zIndex = "2147483647";
            fp.calendarContainer.style.pointerEvents = "auto";
            fp.calendarContainer.style.position = "absolute";
          },
          onClose: (_d, _s, fp) => {
            // Clean up all event listeners
            if (stopRef.current) {
              const events = ['mousedown', 'click', 'touchstart', 'touchend', 'keydown'];
              events.forEach(eventType => {
                stopRef.current.forEach(handler => {
                  fp.calendarContainer.removeEventListener(eventType, handler, { capture: true } as any);
                });
              });
              stopRef.current.clear();
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