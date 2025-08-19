import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingUp, Users, Calendar, AlertCircle } from "lucide-react";
import type { RateationRow } from "@/features/rateations/types";

interface AdvancedStatsProps {
  rows: RateationRow[];
  loading: boolean;
  onBack: () => void;
}

export function AdvancedStats({ rows, loading, onBack }: AdvancedStatsProps) {
  
  const calculateAdvancedMetrics = (rows: RateationRow[]) => {
    const totalRateations = rows.length;
    const activeRateations = rows.filter(row => row.residuo > 0);
    const completedRateations = rows.filter(row => row.residuo === 0);
    
    // Payment efficiency metrics
    const totalInstallments = rows.reduce((sum, row) => sum + row.rateTotali, 0);
    const paidInstallments = rows.reduce((sum, row) => sum + row.ratePagate, 0);
    const lateInstallments = rows.reduce((sum, row) => sum + (row.rateInRitardo || 0), 0);
    const paidLateInstallments = rows.reduce((sum, row) => sum + (row.ratePaidLate || 0), 0);
    
    // Financial metrics
    const totalAmount = rows.reduce((sum, row) => sum + row.importoTotale, 0);
    const paidAmount = rows.reduce((sum, row) => sum + row.importoPagato, 0);
    const residualAmount = rows.reduce((sum, row) => sum + row.residuo, 0);
    const lateAmount = rows.reduce((sum, row) => sum + (row.importoRitardo || 0), 0);
    
    // Calculate ratios and percentages
    const paymentRate = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0;
    const completionRate = totalRateations > 0 ? (completedRateations.length / totalRateations) * 100 : 0;
    const onTimePaymentRate = paidInstallments > 0 ? ((paidInstallments - paidLateInstallments) / paidInstallments) * 100 : 0;
    const latePaymentRate = totalInstallments > 0 ? (lateInstallments / totalInstallments) * 100 : 0;
    
    // Average metrics
    const avgRateationAmount = totalRateations > 0 ? totalAmount / totalRateations : 0;
    const avgInstallmentAmount = totalInstallments > 0 ? totalAmount / totalInstallments : 0;
    const avgInstallmentsPerRateation = totalRateations > 0 ? totalInstallments / totalRateations : 0;
    
    // Risk metrics
    const highRiskRateations = activeRateations.filter(row => 
      (row.rateInRitardo || 0) > (row.rateTotali * 0.3) // More than 30% installments late
    ).length;
    const mediumRiskRateations = activeRateations.filter(row => {
      const lateRatio = (row.rateInRitardo || 0) / row.rateTotali;
      return lateRatio > 0.1 && lateRatio <= 0.3; // 10-30% installments late
    }).length;
    
    return {
      totalRateations,
      activeRateations: activeRateations.length,
      completedRateations: completedRateations.length,
      totalInstallments,
      paidInstallments,
      lateInstallments,
      paidLateInstallments,
      totalAmount,
      paidAmount,
      residualAmount,
      lateAmount,
      paymentRate,
      completionRate,
      onTimePaymentRate,
      latePaymentRate,
      avgRateationAmount,
      avgInstallmentAmount,
      avgInstallmentsPerRateation,
      highRiskRateations,
      mediumRiskRateations,
    };
  };

  const metrics = calculateAdvancedMetrics(rows);

  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount);

  const formatPercentage = (percentage: number) => `${percentage.toFixed(1)}%`;

  const getRiskLevel = (highRisk: number, mediumRisk: number, total: number) => {
    const riskRatio = (highRisk + mediumRisk) / Math.max(total, 1);
    if (riskRatio > 0.3) return { level: 'Alto', color: 'text-destructive', bgColor: 'bg-destructive/10' };
    if (riskRatio > 0.15) return { level: 'Medio', color: 'text-orange-600', bgColor: 'bg-orange-100 dark:bg-orange-950/20' };
    return { level: 'Basso', color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-950/20' };
  };

  const riskAssessment = getRiskLevel(metrics.highRiskRateations, metrics.mediumRiskRateations, metrics.activeRateations);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Caricamento statistiche avanzate...</div>
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
        <h2 className="text-2xl font-bold">Statistiche Avanzate</h2>
      </div>

      {/* Overview Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasso di Completamento</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPercentage(metrics.completionRate)}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.completedRateations} di {metrics.totalRateations} completate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasso di Pagamento</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPercentage(metrics.paymentRate)}</div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(metrics.paidAmount)} di {formatCurrency(metrics.totalAmount)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pagamenti Puntuali</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPercentage(metrics.onTimePaymentRate)}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.paidInstallments - metrics.paidLateInstallments} di {metrics.paidInstallments} rate
            </p>
          </CardContent>
        </Card>

        <Card className={riskAssessment.bgColor}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Livello di Rischio</CardTitle>
            <AlertCircle className={`h-4 w-4 ${riskAssessment.color}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${riskAssessment.color}`}>
              {riskAssessment.level}
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics.highRiskRateations} alto, {metrics.mediumRiskRateations} medio rischio
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Metrics */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Metriche Finanziarie</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Importo Medio per Rateazione</span>
              <span className="font-medium">{formatCurrency(metrics.avgRateationAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Importo Medio per Rata</span>
              <span className="font-medium">{formatCurrency(metrics.avgInstallmentAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Importo Residuo Totale</span>
              <span className="font-medium">{formatCurrency(metrics.residualAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Importo in Ritardo</span>
              <span className="font-medium text-destructive">{formatCurrency(metrics.lateAmount)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Metriche Operative</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Rate Medie per Rateazione</span>
              <span className="font-medium">{metrics.avgInstallmentsPerRateation.toFixed(1)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Rate Totali</span>
              <span className="font-medium">{metrics.totalInstallments}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Rate Pagate</span>
              <span className="font-medium text-green-600">{metrics.paidInstallments}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Rate in Ritardo</span>
              <span className="font-medium text-destructive">{metrics.lateInstallments}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Rate Pagate in Ritardo</span>
              <span className="font-medium text-orange-600">{metrics.paidLateInstallments}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Indicators */}
      <Card>
        <CardHeader>
          <CardTitle>Indicatori di Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold text-green-600">
                {formatPercentage(100 - metrics.latePaymentRate)}
              </div>
              <div className="text-sm text-muted-foreground">Tasso di Puntualità</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold">
                {formatPercentage(metrics.latePaymentRate)}
              </div>
              <div className="text-sm text-muted-foreground">Tasso di Ritardo</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold">
                {metrics.activeRateations}
              </div>
              <div className="text-sm text-muted-foreground">Rateazioni Attive</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Risk Analysis */}
      {metrics.activeRateations > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Analisi del Rischio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-destructive/10">
                <div>
                  <div className="font-medium text-destructive">Rateazioni ad Alto Rischio</div>
                  <div className="text-sm text-muted-foreground">
                    Più del 30% delle rate in ritardo
                  </div>
                </div>
                <div className="text-2xl font-bold text-destructive">
                  {metrics.highRiskRateations}
                </div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-orange-100 dark:bg-orange-950/20">
                <div>
                  <div className="font-medium text-orange-600">Rateazioni a Medio Rischio</div>
                  <div className="text-sm text-muted-foreground">
                    10-30% delle rate in ritardo
                  </div>
                </div>
                <div className="text-2xl font-bold text-orange-600">
                  {metrics.mediumRiskRateations}
                </div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-green-100 dark:bg-green-950/20">
                <div>
                  <div className="font-medium text-green-600">Rateazioni a Basso Rischio</div>
                  <div className="text-sm text-muted-foreground">
                    Meno del 10% delle rate in ritardo
                  </div>
                </div>
                <div className="text-2xl font-bold text-green-600">
                  {metrics.activeRateations - metrics.highRiskRateations - metrics.mediumRiskRateations}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}