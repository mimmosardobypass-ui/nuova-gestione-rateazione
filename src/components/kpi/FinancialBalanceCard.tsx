import { Leaf, Sprout, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { formatEuroFromCents } from "@/lib/formatters";

interface FinancialBalanceCardProps {
  savingRQ: number;
  savingQuinquies?: number;  // NEW: Risparmio R5 (Rottamazione Quinquies 2026)
  costF24PagoPA: number;
  loading?: boolean;
  onClick?: () => void;
}

export function FinancialBalanceCard({ 
  savingRQ, 
  savingQuinquies = 0,  // Default 0 for backward compatibility
  costF24PagoPA, 
  loading = false,
  onClick 
}: FinancialBalanceCardProps) {
  // NEW: Formula aggiornata con risparmio R5
  const netBalance = (savingRQ + savingQuinquies) - costF24PagoPA;
  const isPositive = netBalance >= 0;

  if (loading) {
    return (
      <Card className="cursor-pointer" onClick={onClick}>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-3/4" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-8 w-1/2" />
          <Separator />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card 
      className={`
        relative overflow-hidden transition-all hover:shadow-lg cursor-pointer
        ${isPositive 
          ? 'border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-800' 
          : 'border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-800'
        }
      `}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-primary" />
          Bilancio Finanziario
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {/* Net Balance - Prominent */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Saldo Netto</p>
                <div className="flex items-center gap-2">
                  {isPositive ? (
                    <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
                  )}
                  <p className={`
                    text-3xl font-bold 
                    ${isPositive ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}
                  `}>
                    {isPositive ? '+' : ''}{formatEuroFromCents(Math.round(netBalance * 100))}
                  </p>
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>(Risparmio RQ + Risparmio R5) - Costo F24→PagoPA</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <Separator />

        {/* Breakdown */}
        <div className="space-y-2 text-sm">
          {/* Saving RQ */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center justify-between group hover:bg-muted/50 p-2 rounded-md transition-colors">
                  <div className="flex items-center gap-2">
                    <Leaf className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="font-medium">Risparmio RQ</span>
                  </div>
                  <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800">
                    +{formatEuroFromCents(Math.round(savingRQ * 100))}
                  </Badge>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Differenza tra debito originario e importo ridotto con Rottamazione Quater 2024</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* NEW: Saving R5 (Quinquies) */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center justify-between group hover:bg-muted/50 p-2 rounded-md transition-colors">
                  <div className="flex items-center gap-2">
                    <Sprout className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                    <span className="font-medium">Risparmio R5</span>
                  </div>
                  <Badge variant="outline" className="bg-violet-100 text-violet-700 border-violet-300 dark:bg-violet-950 dark:text-violet-400 dark:border-violet-800">
                    +{formatEuroFromCents(Math.round(savingQuinquies * 100))}
                  </Badge>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Risparmio dalla Rottamazione Quinquies 2026</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Cost F24→PagoPA */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center justify-between group hover:bg-muted/50 p-2 rounded-md transition-colors">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                    <span className="font-medium">Costo F24→PagoPA</span>
                  </div>
                  <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300 dark:bg-red-950 dark:text-red-400 dark:border-red-800">
                    -{formatEuroFromCents(Math.round(costF24PagoPA * 100))}
                  </Badge>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Costo aggiuntivo da migrazione F24 decaduto a PagoPA</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Visual Indicator */}
        <div className={`
          absolute bottom-0 left-0 right-0 h-1
          ${isPositive ? 'bg-emerald-500' : 'bg-red-500'}
        `} />
      </CardContent>
    </Card>
  );
}
