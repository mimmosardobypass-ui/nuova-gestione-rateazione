import { ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface CollapsibleKpiSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  variant?: "default" | "secondary";
}

export function CollapsibleKpiSection({ 
  title, 
  children, 
  defaultOpen = false,
  variant = "default" 
}: CollapsibleKpiSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Card className={cn(
      "p-4",
      variant === "secondary" && "bg-muted/50 border-muted"
    )}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between p-0 h-auto hover:bg-transparent"
          >
            <h3 className="text-sm font-medium text-muted-foreground">
              {title}
            </h3>
            <ChevronDown 
              className={cn(
                "h-4 w-4 transition-transform duration-200",
                isOpen && "rotate-180"
              )} 
            />
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent className="pt-4">
          {children}
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}