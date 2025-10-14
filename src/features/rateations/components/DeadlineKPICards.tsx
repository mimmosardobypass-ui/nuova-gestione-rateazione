import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatEuro } from '@/lib/formatters';
import { AlertCircle, Clock, Calendar, CheckCircle, TrendingUp } from 'lucide-react';
import type { DeadlineKPIs } from '@/features/rateations/hooks/useDeadlines';

interface DeadlineKPICardsProps {
  kpis: DeadlineKPIs;
  loading?: boolean;
}

const KPI_CONFIGS = [
  {
    key: 'saldo_da_pagare',
    title: 'Saldo Da Pagare',
    icon: AlertCircle,
    variant: 'destructive' as const,
    bgClass: 'bg-primary/10',
    textClass: 'text-primary',
    isTotal: true,
  },
  {
    key: 'in_ritardo',
    title: 'In Ritardo',
    icon: AlertCircle,
    variant: 'destructive' as const,
    bgClass: 'bg-destructive/10',
    textClass: 'text-destructive-foreground',
  },
  {
    key: 'entro_7',
    title: 'Entro 7 giorni',
    icon: Clock,
    variant: 'secondary' as const,
    bgClass: 'bg-orange-50 dark:bg-orange-950/50',
    textClass: 'text-orange-600 dark:text-orange-400',
  },
  {
    key: 'entro_30',
    title: 'Entro 30 giorni',
    icon: Calendar,
    variant: 'outline' as const,
    bgClass: 'bg-yellow-50 dark:bg-yellow-950/50',
    textClass: 'text-yellow-600 dark:text-yellow-400',
  },
  {
    key: 'futuro',
    title: 'Future',
    icon: TrendingUp,
    variant: 'secondary' as const,
    bgClass: 'bg-blue-50 dark:bg-blue-950/50',
    textClass: 'text-blue-600 dark:text-blue-400',
  },
  {
    key: 'pagata',
    title: 'Pagate',
    icon: CheckCircle,
    variant: 'default' as const,
    bgClass: 'bg-green-50 dark:bg-green-950/50',
    textClass: 'text-green-600 dark:text-green-400',
  },
] as const;

export function DeadlineKPICards({ kpis, loading = false }: DeadlineKPICardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="h-4 bg-muted rounded w-3/4" />
            </CardHeader>
            <CardContent>
              <div className="h-6 bg-muted rounded w-1/2 mb-2" />
              <div className="h-4 bg-muted rounded w-2/3" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Saldo Da Pagare - Prominente */}
      <Card className="relative overflow-hidden bg-primary/10 border-primary/20">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg font-semibold">Saldo Totale Da Pagare</CardTitle>
          <AlertCircle className="h-6 w-6 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <p className="text-4xl font-bold text-primary">
              {formatEuro(kpis.saldo_da_pagare)}
            </p>
            <p className="text-sm text-muted-foreground">
              Include tutte le rate non pagate nel periodo selezionato
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Other KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {KPI_CONFIGS.filter(c => c.key !== 'saldo_da_pagare').map((config) => {
          const count = kpis[`${config.key}_count` as keyof DeadlineKPIs] as number;
          const amount = kpis[`${config.key}_amount` as keyof DeadlineKPIs] as number;
          const Icon = config.icon;

          return (
            <Card key={config.key} className={`relative overflow-hidden ${config.bgClass}`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{config.title}</CardTitle>
                <Icon className={`h-4 w-4 ${config.textClass}`} />
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold">{count}</span>
                    <Badge variant={config.variant} className="text-xs">
                      rate
                    </Badge>
                  </div>
                  <p className={`text-sm font-medium ${config.textClass}`}>
                    {formatEuro(amount)}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}