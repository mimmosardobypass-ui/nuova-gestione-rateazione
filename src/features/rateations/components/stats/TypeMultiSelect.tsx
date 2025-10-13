import * as React from "react";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import type { RateType } from "../../types/advStats";

const OPTIONS: {label:string; value:RateType}[] = [
  {label:"F24", value:"F24"},
  {label:"PagoPA", value:"PAGOPA"},
  {label:"Rottamazione Quater", value:"ROTTAMAZIONE_QUATER"},
  {label:"Riammissione Quater", value:"RIAMMISSIONE_QUATER"},
  {label:"Altro", value:"ALTRO"},
];

interface TypeMultiSelectProps {
  value: RateType[];
  onChange: (v: RateType[]) => void;
  placeholder?: string;
}

export function TypeMultiSelect({
  value,
  onChange,
  placeholder = "Tipologie"
}: TypeMultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  
  const toggle = (v: RateType) => {
    onChange(value.includes(v) ? value.filter(x=>x!==v) : [...value, v]);
  };
  
  const all = () => onChange(OPTIONS.map(o=>o.value));
  const none = () => onChange([]);

  const label =
    value.length === 0 ? placeholder :
    value.length === OPTIONS.length ? "Tutte le tipologie" :
    OPTIONS.filter(o => value.includes(o.value)).map(o=>o.label).join(", ");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="justify-between min-w-[220px]">
          <span className="truncate">{label}</span>
          <ChevronDown className="ml-2 h-4 w-4 opacity-70 flex-shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[280px]" align="start">
        <Command loop>
          <div className="flex items-center justify-between px-2 py-1.5 border-b">
            <Button size="sm" variant="ghost" onClick={all}>Tutte</Button>
            <Button size="sm" variant="ghost" onClick={none}>Nessuna</Button>
          </div>
          <CommandEmpty>Nessuna tipologia</CommandEmpty>
          <CommandGroup>
            {OPTIONS.map(opt => (
              <CommandItem 
                key={opt.value} 
                onSelect={() => toggle(opt.value)} 
                className="cursor-pointer"
              >
                <Check 
                  className={cn(
                    "mr-2 h-4 w-4", 
                    value.includes(opt.value) ? "opacity-100" : "opacity-0"
                  )} 
                />
                {opt.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
