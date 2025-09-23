import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertCircle, RotateCcw, TrendingUp, ShieldX } from "lucide-react";
import { cn } from "@/lib/utils";

import { formatEuro } from "@/lib/formatters";

type CompactKpiCardProps = {
  title: string;
  value: number | null | undefined;
  subtitle?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  highlight?: "default" | "primary" | "destructive";
  loading?: boolean;
  className?: string;
};

export function CompactKpiCard({
  title,
  value,
  subtitle,
  icon,
  onClick,
  highlight = "default",
  loading,
  className,
}: CompactKpiCardProps) {
  return (
    <Card
      onClick={onClick}
      className={cn(
        "transition-all cursor-default hover:shadow-md",
        onClick && "cursor-pointer",
        highlight === "primary" && "border-primary/30",
        highlight === "destructive" && "border-destructive/30",
        className
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon ?? <TrendingUp className="h-4 w-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-7 w-28" />
        ) : (
          <div className="text-2xl font-bold">{formatEuro(Number(value || 0))}</div>
        )}
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

// Block with 3 cards side by side (responsive)
type ResidualDecadenceRowProps = {
  residualEuro: number;
  decNetEuro: number;
  totalEuro: number;
  loading?: boolean;
  onOpenDecadenze?: () => void;
};

export function ResidualDecadenceRow({
  residualEuro,
  decNetEuro,
  totalEuro,
  loading,
  onOpenDecadenze,
}: ResidualDecadenceRowProps) {
  return (
    <TooltipProvider>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <CompactKpiCard
                title="Totale residuo"
                value={residualEuro}
                icon={<RotateCcw className="h-4 w-4 text-muted-foreground" />}
                loading={loading}
                highlight="default"
              />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Il totale esclude le PagoPA interrotte; i loro residui storici sono visibili nelle rispettive righe</p>
          </TooltipContent>
        </Tooltip>
        
        <CompactKpiCard
          title="Saldo Decaduto"
          value={decNetEuro}
          subtitle="Netto da trasferire"
          icon={<ShieldX className="h-4 w-4 text-muted-foreground" />}
          loading={loading}
          highlight="destructive"
          onClick={onOpenDecadenze}
        />
        <CompactKpiCard
          title="Totale impegni"
          value={totalEuro}
          subtitle="Residuo + Decaduto"
          icon={<AlertCircle className="h-4 w-4 text-muted-foreground" />}
          loading={loading}
          highlight="primary"
        />
      </div>
    </TooltipProvider>
  );
}