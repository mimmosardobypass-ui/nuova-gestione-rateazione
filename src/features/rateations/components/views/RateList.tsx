import React from "react";
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
  onDelete: (id: string) => void;
  deleting?: string | null;
  onRefresh: () => void;
  onDataChanged: () => void;
  refreshKey: number;
  onViewChange: (view: 'annual' | 'deadlines' | 'advanced') => void;
}

export function RateList({ 
  rows, 
  loading, 
  error, 
  online, 
  onDelete, 
  deleting, 
  onRefresh, 
  onDataChanged, 
  refreshKey,
  onViewChange 
}: RateListProps) {
  const processRows = (sourceRows: RateationRow[]) => 
    sourceRows.map(row => ({
      ...row,
      importoRitardo: row.importoRitardo || 0,
      rateInRitardo: row.rateInRitardo || 0
    } as RateationRowPro));

  return (
    <Card className="card-elevated">
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
              onStats={() => onViewChange('advanced')}
              onDeadlines={() => onViewChange('deadlines')}
            />

            <RateationsTablePro 
              key={refreshKey}
              rows={processRows(rows)}
              loading={loading}
              error={error}
              online={online}
              onDelete={onDelete}
              deleting={deleting}
              onRefresh={onRefresh}
              onDataChanged={onDataChanged}
            />
          </TabsContent>
          
          <TabsContent value="attive" className="space-y-4">
            <RateationFilters 
              onComparazione={() => onViewChange('annual')}
              onStats={() => onViewChange('advanced')}
              onDeadlines={() => onViewChange('deadlines')}
            />

            <RateationsTablePro 
              key={refreshKey}
              rows={processRows(rows.filter(row => row.residuo > 0))}
              loading={loading}
              error={error}
              online={online}
              onDelete={onDelete}
              deleting={deleting}
              onRefresh={onRefresh}
              onDataChanged={onDataChanged}
            />
          </TabsContent>
          
          <TabsContent value="completate" className="space-y-4">
            <RateationFilters 
              onComparazione={() => onViewChange('annual')}
              onStats={() => onViewChange('advanced')}
              onDeadlines={() => onViewChange('deadlines')}
            />

            <RateationsTablePro 
              key={refreshKey}
              rows={processRows(rows.filter(row => row.residuo === 0))}
              loading={loading}
              error={error}
              online={online}
              onDelete={onDelete}
              deleting={deleting}
              onRefresh={onRefresh}
              onDataChanged={onDataChanged}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}