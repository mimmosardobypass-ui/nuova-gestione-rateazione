import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RateationsTablePro } from "@/features/rateations/components/RateationsTablePro";
import { RateationFilters } from "@/features/rateations/components/RateationFilters";
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
  onViewChange: (view: 'annual' | 'deadlines') => void;
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
  // State management per i filtri
  const [filters, setFilters] = useState({
    tipo: 'all',
    stato: 'all',
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
      filtered = filtered.filter(row => row.residuo > 0 && (row.rateInRitardo === 0 || row.rateInRitardo === null));
    } else if (filters.stato === 'late') {
      filtered = filtered.filter(row => (row.rateInRitardo ?? 0) > 0 || (row.importoRitardo ?? 0) > 0);
    } else if (filters.stato === 'completed') {
      filtered = filtered.filter(row => row.residuo === 0);
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
  }, [filters]);

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