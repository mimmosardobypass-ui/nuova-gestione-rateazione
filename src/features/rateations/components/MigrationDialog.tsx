import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ArrowRight, Package, Target } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { RateationRow, Debt, RateationDebt } from '../types';
import { fetchActiveDebtsForRateation, migrateDebtsToRQ } from '../api/debts';
import { getMigrablePagopaForRateation, getIneligibilityReasons, MigrablePagopa } from '../api/migrazione';
import { markPagopaInterrupted, getRiamQuaterOptions } from '../api/rateations';

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
  const [migrablePagoPA, setMigrablePagoPA] = useState<MigrablePagopa[]>([]);
  const [rqRateations, setRqRateations] = useState<{ id: string; number: string | null; taxpayer_name: string | null }[]>([]);
  const [selectedDebtIds, setSelectedDebtIds] = useState<string[]>([]);
  const [selectedPagopaIds, setSelectedPagopaIds] = useState<string[]>([]);
  const [targetRateationId, setTargetRateationId] = useState<string>('');
  const [note, setNote] = useState('');
  const [processing, setProcessing] = useState(false);
  const [migrationMode, setMigrationMode] = useState<'debts' | 'pagopa'>('debts');

  const { toast } = useToast();

  // Load data when dialog opens
  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, rateation.id, migrationMode]);

  // Determine migration mode based on rateation type and target
  useEffect(() => {
    if (rateation.is_pagopa) {
      setMigrationMode('pagopa');
    } else {
      setMigrationMode('debts');
    }
  }, [rateation.is_pagopa]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (migrationMode === 'pagopa') {
        // Load migratable PagoPA for PagoPA → RQ migration
        const [pagopaData, rqData] = await Promise.all([
          getMigrablePagopaForRateation(rateation.id),
          getRiamQuaterOptions()
        ]);
        
        setMigrablePagoPA(pagopaData);
        setRqRateations((rqData ?? []).map(r => ({ ...r, id: String(r.id) })));
        
        // Auto-select the current PagoPA if it's migratable
        if (pagopaData.length > 0) {
          // Auto-select the current rateation if it's in the list and nothing is selected
          setSelectedPagopaIds(prev => prev.length ? prev : [pagopaData[0].id]);
        }
      } else {
        // Load debts for normal debt migration
        const [debtsData, rqData] = await Promise.all([
          fetchActiveDebtsForRateation(rateation.id),
          getRiamQuaterOptions()
        ]);
        
        setActiveDebts(debtsData);
        setRqRateations((rqData ?? []).map(r => ({ ...r, id: String(r.id) })));
      }
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

  const handlePagopaSelection = (pagopaId: string | number, checked: boolean) => {
    const id = String(pagopaId);
    setSelectedPagopaIds(prev => 
      checked 
        ? Array.from(new Set([...prev, id]))
        : prev.filter(x => x !== id)
    );
  };

  const handleSelectAll = (checked: boolean) => {
    if (migrationMode === 'pagopa') {
      setSelectedPagopaIds(checked ? migrablePagoPA.map(p => p.id) : []);
    } else {
      setSelectedDebtIds(checked ? activeDebts.map(d => d.debt_id) : []);
    }
  };

  const nothingSelected = migrationMode === 'pagopa'
    ? selectedPagopaIds.length === 0
    : selectedDebtIds.length === 0;

  const disableMigrate = processing || nothingSelected || !targetRateationId;

  // Debug logging for button state
  console.debug('[Migration] Button state', { 
    targetRateationId, 
    type: typeof targetRateationId, 
    disableMigrate, 
    nothingSelected, 
    processing 
  });

  // Helper to generate safe RQ labels for toast messages
  const rqLabel = (id: unknown) => {
    if (!id) return '';
    const strId = String(id);
    const found = rqRateations.find(r => r.id === strId);
    return found?.number ?? strId.slice(-6); // prefer RQ number if available
  };

  // Custom close handler to reset all selections
  const onClose = (open: boolean) => {
    setOpen(open);
    if (!open) {
      // Reset selections when dialog closes
      setSelectedPagopaIds([]);
      setSelectedDebtIds([]);
      setTargetRateationId('');
      setNote('');
    }
  };

  const handleMigration = async () => {
    if (nothingSelected) {
      toast({
        title: migrationMode === 'pagopa' ? "Nessuna cartella PagoPA selezionata" : "Nessuna cartella selezionata",
        description: migrationMode === 'pagopa' ? "Seleziona almeno una cartella PagoPA da migrare" : "Seleziona almeno una cartella da migrare",
        variant: "destructive"
      });
      return;
    }

    if (!targetRateationId) {
      toast({
        title: "Piano RQ non selezionato",
        description: "Seleziona il piano Riam.Quater di destinazione",
        variant: "destructive"
      });
      return;
    }

    if (migrationMode === 'pagopa') {
      // PagoPA → RQ migration
      setProcessing(true);
      try {
        // Use markPagopaInterrupted for each selected PagoPA
        await Promise.all(
          selectedPagopaIds.map(pagopaId => 
            markPagopaInterrupted(pagopaId, targetRateationId, note.trim() || undefined)
          )
        );

        toast({
          title: "Successo",
          description: `Migrate ${selectedPagopaIds.length} cartelle PagoPA verso la RQ ${rqLabel(targetRateationId)}`,
          duration: 5000
        });

        setOpen(false);
        onMigrationComplete?.();
        
        // Reset form
        setSelectedPagopaIds([]);
        setTargetRateationId('');
        setNote('');
      } catch (error) {
        console.error('PagoPA migration error:', error);
        const errorMessage = error instanceof Error ? error.message : "Errore durante la migrazione delle cartelle PagoPA";
        toast({
          title: "Errore",
          description: errorMessage,
          variant: "destructive",
          duration: 8000
        });
      } finally {
        setProcessing(false);
      }
    } else {
      // Normal debt migration
      setProcessing(true);
      try {
        await migrateDebtsToRQ({
          sourceRateationId: rateation.id,
          debtIds: selectedDebtIds,
          targetRateationId: targetRateationId,
          note: note.trim() || undefined
        });

        toast({
          title: "Successo",
          description: `Migrate ${selectedDebtIds.length} cartelle verso il piano RQ ${rqLabel(targetRateationId)}`,
          duration: 5000
        });

        setOpen(false);
        onMigrationComplete?.();
        
        // Reset form
        setSelectedDebtIds([]);
        setTargetRateationId('');
        setNote('');
      } catch (error) {
        console.error('Migration error:', error);
        const errorMessage = error instanceof Error ? error.message : "Errore durante la migrazione delle cartelle";
        toast({
          title: "Errore",
          description: errorMessage,
          variant: "destructive",
          duration: 8000
        });
      } finally {
        setProcessing(false);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="w-[95vw] max-w-[900px] md:w-[85vw] md:max-w-[960px] max-h-[88dvh] md:max-h-[90vh] overflow-hidden p-0 md:rounded-2xl overscroll-contain">
        <DialogHeader className="px-6 py-4 sticky top-0 bg-white z-10 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Gestisci Migrazione Cartelle - {rateation.numero}
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-4 overflow-y-auto overflow-x-hidden max-h-[calc(88dvh-140px)] overscroll-contain touch-pan-y min-w-0">
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
                      <div className="text-sm text-muted-foreground space-y-2">
                        <span className="font-medium">Cartelle già migrate:</span>
                        <div className="flex flex-wrap gap-1">
                          {rateation.migrated_debt_numbers.slice(0, 10).map((number, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs px-2 py-1 max-w-full break-all">
                              {number}
                            </Badge>
                          ))}
                          {rateation.migrated_debt_numbers.length > 10 && (
                            <Popover>
                              <PopoverTrigger asChild>
                                <Badge variant="secondary" className="text-xs px-2 py-1 cursor-pointer hover:bg-secondary/80">
                                  +{rateation.migrated_debt_numbers.length - 10}
                                </Badge>
                              </PopoverTrigger>
                              <PopoverContent className="z-[60] w-80 max-h-64 overflow-auto">
                                <div className="flex flex-wrap gap-2">
                                  {rateation.migrated_debt_numbers.slice(10).map((number, idx) => (
                                    <Badge key={idx} variant="outline" className="text-xs px-2 py-1 break-all">
                                      {number}
                                    </Badge>
                                  ))}
                                </div>
                              </PopoverContent>
                            </Popover>
                          )}
                        </div>
                      </div>
                    )}
                    {rateation.remaining_debt_numbers && rateation.remaining_debt_numbers.length > 0 && (
                      <div className="text-sm text-muted-foreground space-y-2">
                        <span className="font-medium">Cartelle rimanenti:</span>
                        <div className="flex flex-wrap gap-1">
                          {rateation.remaining_debt_numbers.slice(0, 10).map((number, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs px-2 py-1 max-w-full break-all">
                              {number}
                            </Badge>
                          ))}
                          {rateation.remaining_debt_numbers.length > 10 && (
                            <Popover>
                              <PopoverTrigger asChild>
                                <Badge variant="secondary" className="text-xs px-2 py-1 cursor-pointer hover:bg-secondary/80">
                                  +{rateation.remaining_debt_numbers.length - 10}
                                </Badge>
                              </PopoverTrigger>
                              <PopoverContent className="z-[60] w-80 max-h-64 overflow-auto">
                                <div className="flex flex-wrap gap-2">
                                  {rateation.remaining_debt_numbers.slice(10).map((number, idx) => (
                                    <Badge key={idx} variant="outline" className="text-xs px-2 py-1 break-all">
                                      {number}
                                    </Badge>
                                  ))}
                                </div>
                              </PopoverContent>
                            </Popover>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Active Debts/PagoPA Selection */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center justify-between">
                    {migrationMode === 'pagopa' ? 'Cartelle PagoPA Disponibili per Migrazione' : 'Cartelle Disponibili per Migrazione'}
                    <Checkbox
                      checked={
                        migrationMode === 'pagopa' 
                          ? selectedPagopaIds.length === migrablePagoPA.length && migrablePagoPA.length > 0
                          : selectedDebtIds.length === activeDebts.length && activeDebts.length > 0
                      }
                      onCheckedChange={handleSelectAll}
                      disabled={migrationMode === 'pagopa' ? migrablePagoPA.length === 0 : activeDebts.length === 0}
                    />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {migrationMode === 'pagopa' ? (
                    // PagoPA Selection UI
                    migrablePagoPA.length === 0 ? (
                      <div className="space-y-2">
                        <p className="text-muted-foreground text-sm">Nessuna cartella PagoPA migrabile.</p>
                        <div className="text-xs text-muted-foreground space-y-1">
                          <p><strong>Possibili motivi:</strong></p>
                          <ul className="list-disc list-inside space-y-1 ml-2">
                            <li>La PagoPA è già collegata a una RQ</li>
                            <li>La PagoPA è già INTERROTTA</li>
                            <li>La PagoPA è già collegata a un'altra rateazione</li>
                          </ul>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="text-sm text-muted-foreground mb-2">
                          <strong>Cartella corrente:</strong>{' '}
                          {rateation?.numero ? (
                            <span>
                              {rateation.numero}
                              {rateation?.taxpayer_name ? ` — ${rateation.taxpayer_name}` : ''}
                            </span>
                          ) : (
                            '—'
                          )}
                          {typeof rateation?.residuo === 'number' && (
                            <span className="ml-2">
                              (Residuo: €{rateation.residuo.toFixed(2)})
                            </span>
                          )}
                        </div>
                        <div className="border rounded-lg">
                          <div className="space-y-2 max-h-72 overflow-y-auto px-3 py-2">
                          {migrablePagoPA.map((pagopa) => (
                            <div key={pagopa.id} className="flex items-center space-x-2 p-2 border rounded hover:bg-muted/50 transition-colors">
                              <Checkbox
                                checked={selectedPagopaIds.includes(String(pagopa.id))}
                                onCheckedChange={(checked) => handlePagopaSelection(pagopa.id, checked as boolean)}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm truncate">
                                  {pagopa.number} - {pagopa.taxpayer_name}
                                  <Badge variant="secondary" className="ml-2 text-xs">
                                    {pagopa.status}
                                  </Badge>
                                </div>
                              </div>
                              {pagopa.total_amount && (
                                <div className="text-sm text-right flex-shrink-0">
                                  €{pagopa.total_amount.toFixed(2)}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        </div>
                      </div>
                    )
                  ) : (
                    // Normal Debts Selection UI
                    activeDebts.length === 0 ? (
                      <p className="text-muted-foreground text-sm">Nessuna cartella disponibile per la migrazione</p>
                    ) : (
                      <div className="border rounded-lg">
                        <div className="space-y-2 max-h-72 overflow-y-auto px-3 py-2">
                        {activeDebts.map((item) => (
                          <div key={item.debt_id} className="flex items-center space-x-2 p-2 border rounded hover:bg-muted/50 transition-colors">
                            <Checkbox
                              checked={selectedDebtIds.includes(item.debt_id)}
                              onCheckedChange={(checked) => handleDebtSelection(item.debt_id, checked as boolean)}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate">{item.debt.number}</div>
                              {item.debt.description && (
                                <div className="text-xs text-muted-foreground truncate">{item.debt.description}</div>
                              )}
                            </div>
                            {item.debt.original_amount_cents && (
                              <div className="text-sm text-right flex-shrink-0">
                                €{(item.debt.original_amount_cents / 100).toFixed(2)}
                              </div>
                            )}
                          </div>
                        ))}
                        </div>
                      </div>
                    )
                  )}
                </CardContent>
              </Card>

              {/* Target RQ Selection */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    {migrationMode === 'pagopa' ? 'Rateazione RQ di Destinazione' : 'Rateazione di Destinazione'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="target-rateation">
                        {migrationMode === 'pagopa' ? 'Seleziona Piano RQ per la Migrazione' : 'Seleziona Piano RQ'}
                      </Label>
                      <Select value={targetRateationId} onValueChange={setTargetRateationId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Scegli una rateazione RQ..." />
                        </SelectTrigger>
                        <SelectContent>
                          {rqRateations.map((rq) => (
                            <SelectItem key={rq.id} value={String(rq.id)}>
                              {rq.number ?? '—'} {rq.taxpayer_name ? `- ${rq.taxpayer_name}` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {!targetRateationId && (migrationMode === 'pagopa' ? selectedPagopaIds.length > 0 : selectedDebtIds.length > 0) && (
                        <p className="text-xs text-destructive">
                          Seleziona la Riam.Quater per confermare la migrazione
                        </p>
                      )}
                      {rqRateations.length === 0 && (
                        <p className="text-xs text-amber-600">
                          Nessuna Riam.Quater trovata. Crea prima un piano RQ e riprova.
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="migration-note">Note (opzionale)</Label>
                      <Textarea
                        id="migration-note"
                        placeholder={migrationMode === 'pagopa' ? 
                          "Aggiungi note sulla migrazione PagoPA..." : 
                          "Aggiungi note sulla migrazione..."
                        }
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        rows={3}
                        className="w-full resize-none"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 sticky bottom-0 bg-white z-10 border-t">
          <Button variant="outline" onClick={() => onClose(false)} disabled={processing}>
            Annulla
          </Button>
          <Button onClick={handleMigration} disabled={disableMigrate}>
            {processing && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>}
            {processing 
              ? 'Migrazione...' 
              : migrationMode === 'pagopa' 
                ? `Migra ${selectedPagopaIds.length > 0 ? selectedPagopaIds.length : ''} PagoPA`.trim()
                : `Migra ${selectedDebtIds.length > 0 ? selectedDebtIds.length : ''} cartelle`.trim()
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};