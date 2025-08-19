import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, AlertTriangle, Clock } from "lucide-react";
import { format, addDays, isAfter, isBefore, differenceInDays } from "date-fns";
import { it } from "date-fns/locale";
import type { RateationRow } from "@/features/rateations/types";

interface DeadlinesProps {
  rows: RateationRow[];
  loading: boolean;
  onBack: () => void;
}

interface DeadlineItem {
  rateationId: string;
  rateationNumber: string;
  taxpayerName: string | null;
  installmentSeq: number;
  amount: number;
  dueDate: Date;
  status: 'overdue' | 'due-soon' | 'upcoming';
  daysUntilDue: number;
}

export function Deadlines({ rows, loading, onBack }: DeadlinesProps) {
  const today = new Date();
  const nextWeek = addDays(today, 7);
  const nextMonth = addDays(today, 30);

  // Mock function to generate installment deadlines from rateations
  // In real implementation, you would fetch actual installment data
  const generateDeadlines = (rows: RateationRow[]): DeadlineItem[] => {
    const deadlines: DeadlineItem[] = [];
    
    rows.forEach(row => {
      // Mock: generate some upcoming installments for active rateations
      if (row.residuo > 0 && row.ratePagate < row.rateTotali) {
        const remainingInstallments = row.rateTotali - row.ratePagate;
        
        // Generate up to 3 upcoming installments
        for (let i = 0; i < Math.min(remainingInstallments, 3); i++) {
          const dueDate = addDays(today, Math.random() * 60 - 10); // Random dates within 2 months
          const daysUntilDue = differenceInDays(dueDate, today);
          
          let status: DeadlineItem['status'] = 'upcoming';
          if (daysUntilDue < 0) {
            status = 'overdue';
          } else if (daysUntilDue <= 7) {
            status = 'due-soon';
          }

          deadlines.push({
            rateationId: row.id,
            rateationNumber: row.numero,
            taxpayerName: row.contribuente,
            installmentSeq: row.ratePagate + i + 1,
            amount: row.importoTotale / row.rateTotali, // Mock equal installments
            dueDate,
            status,
            daysUntilDue,
          });
        }
      }
    });

    return deadlines.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  };

  const deadlines = generateDeadlines(rows);
  const overdueDeadlines = deadlines.filter(d => d.status === 'overdue');
  const dueSoonDeadlines = deadlines.filter(d => d.status === 'due-soon');
  const upcomingDeadlines = deadlines.filter(d => d.status === 'upcoming');

  const getStatusBadge = (status: DeadlineItem['status']) => {
    switch (status) {
      case 'overdue':
        return <Badge variant="destructive">In ritardo</Badge>;
      case 'due-soon':
        return <Badge variant="secondary">Scade presto</Badge>;
      case 'upcoming':
        return <Badge variant="outline">Prossima</Badge>;
    }
  };

  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount);

  const formatDate = (date: Date) => 
    format(date, "d MMM yyyy", { locale: it });

  const DeadlineCard = ({ deadline }: { deadline: DeadlineItem }) => (
    <Card className={`border ${
      deadline.status === 'overdue' 
        ? 'border-destructive bg-destructive/5' 
        : deadline.status === 'due-soon'
        ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20'
        : ''
    }`}>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-medium">Rateazione #{deadline.rateationNumber}</span>
              {getStatusBadge(deadline.status)}
            </div>
            {deadline.taxpayerName && (
              <div className="text-sm text-muted-foreground">
                {deadline.taxpayerName}
              </div>
            )}
            <div className="text-sm">
              Rata {deadline.installmentSeq} - {formatCurrency(deadline.amount)}
            </div>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {formatDate(deadline.dueDate)}
              {deadline.daysUntilDue !== 0 && (
                <span className={`ml-1 ${
                  deadline.daysUntilDue < 0 ? 'text-destructive' : 'text-muted-foreground'
                }`}>
                  ({deadline.daysUntilDue < 0 ? `${Math.abs(deadline.daysUntilDue)} giorni fa` : `tra ${deadline.daysUntilDue} giorni`})
                </span>
              )}
            </div>
          </div>
          {deadline.status === 'overdue' && (
            <AlertTriangle className="h-4 w-4 text-destructive" />
          )}
          {deadline.status === 'due-soon' && (
            <Clock className="h-4 w-4 text-orange-500" />
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Caricamento scadenze...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Torna alla lista
        </Button>
        <h2 className="text-2xl font-bold">Scadenze</h2>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Ritardo</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{overdueDeadlines.length}</div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(overdueDeadlines.reduce((sum, d) => sum + d.amount, 0))}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scadono Entro 7 Giorni</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{dueSoonDeadlines.length}</div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(dueSoonDeadlines.reduce((sum, d) => sum + d.amount, 0))}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Prossime Scadenze</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcomingDeadlines.length}</div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(upcomingDeadlines.reduce((sum, d) => sum + d.amount, 0))}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Deadline Lists */}
      {overdueDeadlines.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-destructive mb-3 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Scadenze in Ritardo
          </h3>
          <div className="grid gap-3">
            {overdueDeadlines.map((deadline, index) => (
              <DeadlineCard key={`overdue-${index}`} deadline={deadline} />
            ))}
          </div>
        </div>
      )}

      {dueSoonDeadlines.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-orange-600 mb-3 flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Scadono Entro 7 Giorni
          </h3>
          <div className="grid gap-3">
            {dueSoonDeadlines.map((deadline, index) => (
              <DeadlineCard key={`due-soon-${index}`} deadline={deadline} />
            ))}
          </div>
        </div>
      )}

      {upcomingDeadlines.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Prossime Scadenze
          </h3>
          <div className="grid gap-3">
            {upcomingDeadlines.slice(0, 10).map((deadline, index) => (
              <DeadlineCard key={`upcoming-${index}`} deadline={deadline} />
            ))}
          </div>
        </div>
      )}

      {deadlines.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground">
              Nessuna scadenza trovata per le rateazioni attive
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}