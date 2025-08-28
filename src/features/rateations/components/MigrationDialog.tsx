import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Package, Target } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { RateationRow, Debt, RateationDebt } from '../types';
import { fetchActiveDebtsForRateation, fetchRQRateations, migrateDebtsToRQ } from '../api/debts';

interface MigrationDialogProps {
  rateation: RateationRow;
  trigger: React.ReactNode;
  onMigrationComplete?: () => void;
}

export const MigrationDialog: React.FC<MigrationDialogProps> = ({
  rateation,
  trigger,
  onMigrationComplete
}) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeDebts, setActiveDebts] = useState<(RateationDebt & { debt: Debt })[]>([]);
  const [rqRateations, setRqRateations] = useState<Array<{ id: number; number: string; taxpayer_name?: string }>>([]);
  const [selectedDebtIds, setSelectedDebtIds] = useState<string[]>([]);
  const [targetRateationId, setTargetRateationId] = useState<string>('');
  const [note, setNote] = useState('');
  const [processing, setProcessing] = useState(false);

  const { toast } = useToast();

  // Load data when dialog opens
  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, rateation.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [debtsData, rqData] = await Promise.all([
        fetchActiveDebtsForRateation(parseInt(rateation.id)),
        fetchRQRateations()
      ]);
      
      setActiveDebts(debtsData);
      setRqRateations(rqData);
    } catch (error) {
      console.error('Error loading migration data:', error);
      toast({
        title: "Errore",
        description: "Errore nel caricamento dei dati di migrazione",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDebtSelection = (debtId: string, checked: boolean) => {
    setSelectedDebtIds(prev => 
      checked 
        ? [...prev, debtId]
        : prev.filter(id => id !== debtId)
    );
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedDebtIds(checked ? activeDebts.map(d => d.debt_id) : []);
  };

  const handleMigration = async () => {
    if (selectedDebtIds.length === 0) {
      toast({
        title: "Errore",
        description: "Seleziona almeno una cartella da migrare",
        variant: "destructive"
      });
      return;
    }

    if (!targetRateationId) {
      toast({
        title: "Errore", 
        description: "Seleziona una rateazione di destinazione",
        variant: "destructive"
      });
      return;
    }

    setProcessing(true);
    try {
      await migrateDebtsToRQ({
        sourceRateationId: parseInt(rateation.id),
        debtIds: selectedDebtIds,
        targetRateationId: parseInt(targetRateationId),
        note: note.trim() || undefined
      });

      toast({
        title: "Successo",
        description: `Migrate ${selectedDebtIds.length} cartelle verso la rateazione RQ`,
      });

      setOpen(false);
      onMigrationComplete?.();
      
      // Reset form
      setSelectedDebtIds([]);
      setTargetRateationId('');
      setNote('');
    } catch (error) {
      console.error('Migration error:', error);
      toast({
        title: "Errore",
        description: "Errore durante la migrazione delle cartelle",
        variant: "destructive"
      });
    } finally {
      setProcessing(false);
    }
  };

  if (!rateation.is_pagopa) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Gestisci Migrazione Cartelle - {rateation.numero}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Current Migration Status */}
            {rateation.rq_migration_status !== 'none' && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Stato Migrazione Attuale</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Badge variant={rateation.rq_migration_status === 'full' ? 'default' : 'secondary'}>
                    {rateation.rq_migration_status === 'full' ? 'Completamente migrata' : 'Parzialmente migrata'}
                  </Badge>
                  {rateation.migrated_debt_numbers && rateation.migrated_debt_numbers.length > 0 && (
                    <div className="text-sm text-muted-foreground">
                      Cartelle già migrate: {rateation.migrated_debt_numbers.join(', ')}
                    </div>
                  )}
                  {rateation.remaining_debt_numbers && rateation.remaining_debt_numbers.length > 0 && (
                    <div className="text-sm text-muted-foreground">
                      Cartelle rimanenti: {rateation.remaining_debt_numbers.join(', ')}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Active Debts Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center justify-between">
                  Cartelle Disponibili per Migrazione
                  <Checkbox
                    checked={selectedDebtIds.length === activeDebts.length && activeDebts.length > 0}
                    onCheckedChange={handleSelectAll}
                    disabled={activeDebts.length === 0}
                  />
                </CardTitle>
              </CardHeader>
              <CardContent>
                {activeDebts.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Nessuna cartella disponibile per la migrazione</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {activeDebts.map((item) => (
                      <div key={item.debt_id} className="flex items-center space-x-2 p-2 border rounded">
                        <Checkbox
                          checked={selectedDebtIds.includes(item.debt_id)}
                          onCheckedChange={(checked) => handleDebtSelection(item.debt_id, checked as boolean)}
                        />
                        <div className="flex-1">
                          <div className="font-medium text-sm">{item.debt.number}</div>
                          {item.debt.description && (
                            <div className="text-xs text-muted-foreground">{item.debt.description}</div>
                          )}
                        </div>
                        {item.debt.original_amount_cents && (
                          <div className="text-sm text-right">
                            €{(item.debt.original_amount_cents / 100).toFixed(2)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Target RQ Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Rateazione di Destinazione
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="target-rateation">Seleziona Piano RQ</Label>
                  <Select value={targetRateationId} onValueChange={setTargetRateationId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Scegli una rateazione RQ..." />
                    </SelectTrigger>
                    <SelectContent>
                      {rqRateations.map((rq) => (
                        <SelectItem key={rq.id} value={rq.id.toString()}>
                          {rq.number} {rq.taxpayer_name ? `- ${rq.taxpayer_name}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="migration-note">Note (opzionale)</Label>
                  <Textarea
                    id="migration-note"
                    placeholder="Aggiungi note sulla migrazione..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={processing}>
                Annulla
              </Button>
              <Button 
                onClick={handleMigration}
                disabled={selectedDebtIds.length === 0 || !targetRateationId || processing}
                className="flex items-center gap-2"
              >
                {processing ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
                Migra {selectedDebtIds.length} Cartelle
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};