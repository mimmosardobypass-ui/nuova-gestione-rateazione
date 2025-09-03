import * as React from "react";
import { format, parse, isValid } from "date-fns";
import { it } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

type Props = {
  value?: string | Date | null;     // ISO "YYYY-MM-DD" o Date
  onChange: (date: Date | null) => void;
  minDate?: Date;
  maxDate?: Date;
  disabled?: boolean;
  className?: string;
};

const toDate = (v?: string | Date | null): Date | null => {
  if (!v) return null;
  if (v instanceof Date) return isValid(v) ? v : null;
  // accettiamo ISO "YYYY-MM-DD"
  const p = parse(v, "yyyy-MM-dd", new Date());
  return isValid(p) ? p : null;
};

export function DateCellPicker({
  value,
  onChange,
  minDate,
  maxDate,
  disabled,
  className,
}: Props) {
  const date = toDate(value);
  const [text, setText] = React.useState(date ? format(date, "dd/MM/yyyy") : "");

  React.useEffect(() => {
    const d = toDate(value);
    setText(d ? format(d, "dd/MM/yyyy") : "");
  }, [value]);

  const handlePick = (d?: Date) => {
    if (!d) return;
    onChange(d);
    setText(format(d, "dd/MM/yyyy"));
  };

  const handleBlur = () => {
    if (!text) { 
      onChange(null); 
      return; 
    }
    const parsed = parse(text, "dd/MM/yyyy", new Date());
    onChange(isValid(parsed) ? parsed : null);
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Fallback input (digitabile) */}
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={handleBlur}
        placeholder="dd/MM/yyyy"
        className="w-[110px] h-8"
        disabled={disabled}
        inputMode="numeric"
      />

      {/* Calendar popover */}
      <Popover modal={false}>
        <PopoverTrigger asChild>
          <Button 
            variant="outline" 
            type="button" 
            className="h-8 w-8 p-0" 
            disabled={disabled}
          >
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>

        {/* PORTAL + z-index alto per stare sopra al Dialog */}
        <PopoverContent
          align="start"
          side="bottom"
          sideOffset={6}
          className="p-0 z-[1000] w-auto"
        >
          <Calendar
            mode="single"
            selected={date ?? undefined}
            onSelect={handlePick}
            initialFocus
            locale={it}
            // header con tendine mese/anno
            captionLayout="dropdown-buttons"
            fromYear={1990}
            toYear={2099}
            // opzionale: disabilita fuori range
            disabled={(d) =>
              (minDate && d < minDate) || (maxDate && d > maxDate)
            }
            className="pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}