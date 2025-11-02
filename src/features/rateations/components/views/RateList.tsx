import React, { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { RateationsTablePro } from "@/features/rateations/components/RateationsTablePro";
import { RateationFilters } from "@/features/rateations/components/RateationFilters";
import { PrintService } from "@/utils/printUtils";
import type { RateationRowPro } from "@/features/rateations/components/RateationsTablePro";
import type { RateationRow } from "@/features/rateations/types";

interface RateListProps {
  rows: RateationRow[];
  loading: boolean;
  error?: string | null;
  online: boolean;
  onRefresh: () => void;
  onDataChanged: () => void;
  refreshKey: number;
  onViewChange: (view: 'annual' | 'annual-v2' | 'deadlines') => void;
  onStats: () => void;
}

export function RateList({ 
  rows, 
  loading, 
  error, 
  online, 
  onRefresh,
  onDataChanged, 
  refreshKey,
  onViewChange,
  onStats
}: RateListProps) {
  const [searchParams] = useSearchParams();
  const filterParam = searchParams.get('filter'); // NEW: Unified filter system
  const atRiskFilter = searchParams.get('at_risk') === 'true'; // LEGACY: backward compatibility
  const pagopaIdsParam = searchParams.get('pagopa_ids'); // IDs delle PagoPA a rischio
  const tipoFromUrl = searchParams.get('tipo');

  // State management per i filtri
  const [filters, setFilters] = useState({
    tipo: tipoFromUrl || 'all',
    stato: 'active_with_pending_decayed', // Default: mostra solo debito "reale"
    mese: '',
    anno: ''
  });

  // Handler per cambiare i filtri
  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  // Handler per reset filtri
  const handleResetFilters = () => {
    setFilters({
      tipo: 'all',
      stato: 'all',
      mese: '',
      anno: ''
    });
  };

  // Funzione di filtraggio applicata a tutte le rows
  const applyFilters = useMemo(() => (sourceRows: RateationRow[]) => {
    let filtered = sourceRows;
    
    // Filtro per tipo
    if (filters.tipo !== 'all') {
      filtered = filtered.filter(row => row.tipo === filters.tipo);
    }
    
    // Filtro per stato
    if (filters.stato === 'active') {
      // Attiva = residuo > 0 E non completata/decaduta/estinta/interrotta
      // Include anche rateazioni con rate in ritardo (sono ancora attive, non decadute)
      // Esclude INTERROTTA perché sono state sostituite da nuove rateazioni RQ
      filtered = filtered.filter(row => {
        const status = row.status?.toUpperCase();
        return row.residuo > 0 && 
               status !== 'COMPLETATA' && 
               status !== 'DECADUTA' && 
               status !== 'ESTINTA' &&
               status !== 'INTERROTTA';
      });
    } else if (filters.stato === 'late') {
      filtered = filtered.filter(row => (row.rateInRitardo ?? 0) > 0 || (row.importoRitardo ?? 0) > 0);
    } else if (filters.stato === 'decayed') {
      // Solo F24 decadute (tutte: sia in attesa che già agganciate)
      filtered = filtered.filter(row => {
        const status = row.status?.toUpperCase();
        // Status DECADUTA o F24 INTERROTTA (ex-decaduta agganciata)
        return status === 'DECADUTA' || 
               (row.is_f24 && status === 'INTERROTTA');
      });
    } else if (filters.stato === 'active_with_pending_decayed') {
      // Debito effettivo: Attive + F24 Decadute non ancora agganciate
      filtered = filtered.filter(row => {
        const status = row.status?.toUpperCase();
        
        // CASO A: Rateazioni ATTIVE (PagoPA, F24, RQ in corso)
        const isActive = row.residuo > 0 && 
                         status !== 'COMPLETATA' && 
                         status !== 'DECADUTA' && 
                         status !== 'ESTINTA' &&
                         status !== 'INTERROTTA';
        
        // CASO B: F24 DECADUTE in attesa di cartella (non ancora agganciate)
        // Una F24 è "in attesa" se ha status DECADUTA e residuo > 0
        const isPendingDecayed = row.is_f24 && 
                                 status === 'DECADUTA' &&
                                 row.residuo > 0;
        
        return isActive || isPendingDecayed;
      });
    } else if (filters.stato === 'completed') {
      filtered = filtered.filter(row => row.residuo === 0);
    }
    
    // NEW: Unified At-Risk Filter System
    if (filterParam === 'f24-at-risk') {
      // F24 at risk: giorni al prossimo pagamento ≤ 20
      filtered = filtered.filter(row => {
        return row.is_f24 && row.f24_days_to_next_due != null && row.f24_days_to_next_due <= 20;
      });
    } else if (filterParam === 'pagopa-at-risk') {
      // PagoPA at risk: filtra per ID passati nell'URL
      if (pagopaIdsParam) {
        const pagopaIds = pagopaIdsParam.split(',').map(id => id.trim());
        filtered = filtered.filter(row => row.is_pagopa && pagopaIds.includes(String(row.id)));
      } else {
        // Fallback: filtra solo per unpaid_overdue_today >= 7
        filtered = filtered.filter(row => {
          return row.is_pagopa && 
                 row.unpaid_overdue_today != null && 
                 row.unpaid_overdue_today >= 7;
        });
      }
    } else if (filterParam === 'unified-at-risk') {
      // Unified at-risk: mostra sia F24 che PagoPA a rischio
      filtered = filtered.filter(row => {
        const isF24AtRisk = row.is_f24 && row.f24_days_to_next_due != null && row.f24_days_to_next_due <= 20;
        const isPagopaAtRisk = row.is_pagopa && row.unpaid_overdue_today != null && row.unpaid_overdue_today >= 7;
        return isF24AtRisk || isPagopaAtRisk;
      });
    } else if (atRiskFilter) {
      // LEGACY: backward compatibility per vecchi link ?at_risk=true
      filtered = filtered.filter(row => {
        return row.is_f24 && row.f24_days_to_next_due != null && row.f24_days_to_next_due <= 20;
      });
    }
    
    // Filtro per anno (basato su numero rateazione se disponibile, altrimenti skip)
    // Nota: potrebbe essere necessario un campo created_at per filtraggio più accurato
    if (filters.anno) {
      const anno = filters.anno;
      filtered = filtered.filter(row => {
        // Cerca l'anno nel numero della rateazione (es. "2024/001")
        return row.numero?.includes(anno) || row.number?.includes(anno);
      });
    }
    
    return filtered;
  }, [filters, filterParam, atRiskFilter, pagopaIdsParam]);

  const processRows = (sourceRows: RateationRow[]) => 
    sourceRows.map(row => ({
      ...row,
      // Solo default visivi - NON toccare i KPI
      importoRitardo: row.importoRitardo ?? 0,
      rateInRitardo: row.rateInRitardo ?? row.unpaid_overdue_today ?? 0,
      is_pagopa: !!row.is_pagopa,
      residuoEffettivo: row.residuoEffettivo ?? row.residuo, // Fallback to residuo if not set
      // Migration fields with defaults
      debts_total: row.debts_total ?? 0,
      debts_migrated: row.debts_migrated ?? 0,
      migrated_debt_numbers: row.migrated_debt_numbers ?? [],
      remaining_debt_numbers: row.remaining_debt_numbers ?? [],
      rq_target_ids: row.rq_target_ids ?? [],
      rq_migration_status: row.rq_migration_status ?? 'none',
      excluded_from_stats: row.excluded_from_stats ?? false,
    } as RateationRowPro));

  // Determine which print buttons to show based on active filter
  const showF24Print = filterParam === 'f24-at-risk';
  const showPagopaAtRiskPrint = filterParam === 'pagopa-at-risk';
  const showUnifiedPrint = filterParam === 'unified-at-risk';

  return (
    <Card className="card-elevated min-w-0">
      <CardContent className="pt-6">
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">Tutte</TabsTrigger>
            <TabsTrigger value="attive">Attive</TabsTrigger>
            <TabsTrigger value="completate">Completate</TabsTrigger>
          </TabsList>
          
          <TabsContent value="all" className="space-y-4">
            {/* Conditional Print Buttons */}
            {(showF24Print || showPagopaAtRiskPrint || showUnifiedPrint) && (
              <div className="flex justify-end gap-2 mb-4">
                {showF24Print && (
                  <>
                    <Button
                      onClick={() => PrintService.openF24AtRiskPreview()}
                      variant="default"
                      size="sm"
                      className="gap-2"
                    >
                      <FileText className="h-4 w-4" />
                      Stampa Report F24
                    </Button>
                    <Button
                      onClick={() => PrintService.openUnifiedAtRiskPreview()}
                      variant="outline"
                      size="sm"
                      className="gap-2"
                    >
                      <FileText className="h-4 w-4" />
                      Stampa Report Completo
                    </Button>
                  </>
                )}
                {showPagopaAtRiskPrint && (
                  <>
                    <Button
                      onClick={() => PrintService.openPagopaAtRiskPreview()}
                      variant="default"
                      size="sm"
                      className="gap-2"
                    >
                      <FileText className="h-4 w-4" />
                      Stampa Report PagoPA
                    </Button>
                    <Button
                      onClick={() => PrintService.openUnifiedAtRiskPreview()}
                      variant="outline"
                      size="sm"
                      className="gap-2"
                    >
                      <FileText className="h-4 w-4" />
                      Stampa Report Completo
                    </Button>
                  </>
                )}
                {showUnifiedPrint && (
                  <Button
                    onClick={() => PrintService.openUnifiedAtRiskPreview()}
                    variant="default"
                    size="sm"
                    className="gap-2"
                  >
                    <FileText className="h-4 w-4" />
                    Stampa Report Completo (F24 + PagoPA)
                  </Button>
                )}
              </div>
            )}

            <RateationFilters
              onComparazione={() => onViewChange('annual')}
              onStats={onStats}
              onDeadlines={() => onViewChange('deadlines')}
              filters={filters}
              onFilterChange={handleFilterChange}
              onResetFilters={handleResetFilters}
            />

            <RateationsTablePro 
              key={refreshKey}
              rows={processRows(applyFilters(rows))}
              loading={loading}
              error={error}
              online={online}
              onRefresh={onRefresh}
              onDataChanged={onDataChanged}
            />
          </TabsContent>
          
          <TabsContent value="attive" className="space-y-4">
            <RateationFilters 
              onComparazione={() => onViewChange('annual')}
              onStats={onStats}
              onDeadlines={() => onViewChange('deadlines')}
              filters={filters}
              onFilterChange={handleFilterChange}
              onResetFilters={handleResetFilters}
            />

            <RateationsTablePro 
              key={refreshKey}
              rows={processRows(applyFilters(rows.filter(row => row.residuo > 0)))}
              loading={loading}
              error={error}
              online={online}
              onRefresh={onRefresh}
              onDataChanged={onDataChanged}
            />
          </TabsContent>
          
          <TabsContent value="completate" className="space-y-4">
            <RateationFilters 
              onComparazione={() => onViewChange('annual')}
              onStats={onStats}
              onDeadlines={() => onViewChange('deadlines')}
              filters={filters}
              onFilterChange={handleFilterChange}
              onResetFilters={handleResetFilters}
            />

            <RateationsTablePro 
              key={refreshKey}
              rows={processRows(applyFilters(rows.filter(row => row.residuo === 0)))}
              loading={loading}
              error={error}
              online={online}
              onRefresh={onRefresh}
              onDataChanged={onDataChanged}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
