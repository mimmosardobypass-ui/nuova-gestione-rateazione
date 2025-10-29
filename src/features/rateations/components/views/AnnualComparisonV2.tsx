/**
 * AnnualComparisonV2 - Versione Sperimentale
 * 
 * Questa è una copia indipendente di AnnualComparison.tsx per testare miglioramenti
 * senza impattare la versione produttiva esistente.
 * 
 * TODO V2:
 * - Rimuovere Math.random() e implementare filtro year reale basato su created_at
 * - Aggiungere selector per range anni personalizzati
 * - Implementare grafici trend multi-anno
 * - Aggiungere export Excel/PDF
 */

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, TrendingUp, TrendingDown } from "lucide-react";
import type { RateationRow } from "@/features/rateations/types";

interface AnnualComparisonV2Props {
  rows: RateationRow[];
  loading: boolean;
  onBack: () => void;
}

export function AnnualComparisonV2({ rows, loading, onBack }: AnnualComparisonV2Props) {
  const currentYear = new Date().getFullYear();
  const previousYear = currentYear - 1;

  // Calculate statistics by year
  const calculateYearStats = (year: number) => {
    // For this mock implementation, we'll use creation date to filter by year
    // In a real implementation, you might have actual year data in your rateations
    const yearRows = rows.filter(row => {
      // Since we don't have explicit year data, we'll distribute randomly for demo
      return Math.random() > 0.5; // Mock year filtering
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
        <div className="text-muted-foreground">Caricamento confronto annuale V2...</div>
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
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold">Confronto Annuale V2</h2>
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
            Beta
          </Badge>
        </div>
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
