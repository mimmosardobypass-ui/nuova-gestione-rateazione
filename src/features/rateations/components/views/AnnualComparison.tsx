import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingUp, TrendingDown } from "lucide-react";
import type { RateationRow } from "@/features/rateations/types";

interface AnnualComparisonProps {
  rows: RateationRow[];
  loading: boolean;
  onBack: () => void;
}

export function AnnualComparison({ rows, loading, onBack }: AnnualComparisonProps) {
  const currentYear = new Date().getFullYear();
  const previousYear = currentYear - 1;

  // Calculate statistics by year using real created_at field
  const calculateYearStats = (year: number) => {
    const yearRows = rows.filter(row => {
      // Extract year from created_at or start_due_date
      if (!row.created_at && !row.start_due_date) return false;
      
      const dateStr = row.created_at || row.start_due_date;
      const rowYear = new Date(dateStr).getFullYear();
      
      return rowYear === year;
    });

    return {
      totalRateations: yearRows.length,
      totalAmount: yearRows.reduce((sum, row) => sum + row.importoTotale, 0),
      paidAmount: yearRows.reduce((sum, row) => sum + row.importoPagato, 0),
      residualAmount: yearRows.reduce((sum, row) => sum + row.residuo, 0),
      lateAmount: yearRows.reduce((sum, row) => sum + (row.importoRitardo || 0), 0),
    };
  };

  const currentStats = calculateYearStats(currentYear);
  const previousStats = calculateYearStats(previousYear);

  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  };

  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount);

  const formatPercentage = (percentage: number) => 
    `${percentage > 0 ? '+' : ''}${percentage.toFixed(1)}%`;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Caricamento confronto annuale...</div>
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
        <h2 className="text-2xl font-bold">Confronto Annuale</h2>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rateazioni Totali</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentStats.totalRateations}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              <span className="mr-1">{previousYear}: {previousStats.totalRateations}</span>
              {calculateChange(currentStats.totalRateations, previousStats.totalRateations) > 0 ? (
                <TrendingUp className="h-3 w-3 text-green-500" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-500" />
              )}
              <span className={`ml-1 ${
                calculateChange(currentStats.totalRateations, previousStats.totalRateations) > 0 
                  ? 'text-green-500' 
                  : 'text-red-500'
              }`}>
                {formatPercentage(calculateChange(currentStats.totalRateations, previousStats.totalRateations))}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Importo Totale</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(currentStats.totalAmount)}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              <span className="mr-1">{previousYear}: {formatCurrency(previousStats.totalAmount)}</span>
              {calculateChange(currentStats.totalAmount, previousStats.totalAmount) > 0 ? (
                <TrendingUp className="h-3 w-3 text-green-500" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-500" />
              )}
              <span className={`ml-1 ${
                calculateChange(currentStats.totalAmount, previousStats.totalAmount) > 0 
                  ? 'text-green-500' 
                  : 'text-red-500'
              }`}>
                {formatPercentage(calculateChange(currentStats.totalAmount, previousStats.totalAmount))}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pagato</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(currentStats.paidAmount)}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              <span className="mr-1">{previousYear}: {formatCurrency(previousStats.paidAmount)}</span>
              {calculateChange(currentStats.paidAmount, previousStats.paidAmount) > 0 ? (
                <TrendingUp className="h-3 w-3 text-green-500" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-500" />
              )}
              <span className={`ml-1 ${
                calculateChange(currentStats.paidAmount, previousStats.paidAmount) > 0 
                  ? 'text-green-500' 
                  : 'text-red-500'
              }`}>
                {formatPercentage(calculateChange(currentStats.paidAmount, previousStats.paidAmount))}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Residuo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(currentStats.residualAmount)}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              <span className="mr-1">{previousYear}: {formatCurrency(previousStats.residualAmount)}</span>
              {calculateChange(currentStats.residualAmount, previousStats.residualAmount) < 0 ? (
                <TrendingUp className="h-3 w-3 text-green-500" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-500" />
              )}
              <span className={`ml-1 ${
                calculateChange(currentStats.residualAmount, previousStats.residualAmount) < 0 
                  ? 'text-green-500' 
                  : 'text-red-500'
              }`}>
                {formatPercentage(calculateChange(currentStats.residualAmount, previousStats.residualAmount))}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Riepilogo Confronto {previousYear} vs {currentYear}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">{previousYear}</h4>
                <div className="space-y-1 text-sm">
                  <div>Rateazioni: {previousStats.totalRateations}</div>
                  <div>Totale: {formatCurrency(previousStats.totalAmount)}</div>
                  <div>Pagato: {formatCurrency(previousStats.paidAmount)}</div>
                  <div>Residuo: {formatCurrency(previousStats.residualAmount)}</div>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">{currentYear}</h4>
                <div className="space-y-1 text-sm">
                  <div>Rateazioni: {currentStats.totalRateations}</div>
                  <div>Totale: {formatCurrency(currentStats.totalAmount)}</div>
                  <div>Pagato: {formatCurrency(currentStats.paidAmount)}</div>
                  <div>Residuo: {formatCurrency(currentStats.residualAmount)}</div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}