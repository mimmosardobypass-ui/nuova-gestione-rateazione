import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ArrowRight, Package, Target, Euro } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { RateationRow, Debt, RateationDebt } from '../types';
import { fetchActiveDebtsForRateation, migrateDebtsToRQ } from '../api/debts';
import { getMigrablePagopaForRateation, getIneligibilityReasons, MigrablePagopa } from '../api/migrazione';
import { markPagopaInterrupted, getRiamQuaterOptions } from '../api/rateations';
import { migratePagopaAttachRq, undoPagopaLinks, getPagopaLinks } from '../api/linkPagopa';
import { fetchSelectableRqForPagopa, RqLight } from '@/integrations/supabase/api/rq';

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
  const [rqRateations, setRqRateations] = useState<{ id: number; number: string | null; taxpayer_name: string | null }[]>([]);
  const [selectedDebtIds, setSelectedDebtIds] = useState<number[]>([]);
  const [selectedPagopaIds, setSelectedPagopaIds] = useState<number[]>([]);
  const [targetRateationId, setTargetRateationId] = useState<number | null>(null);
  const [selectedRqIds, setSelectedRqIds] = useState<number[]>([]); // Multi-selection for PagoPA mode
  const [note, setNote] = useState('');
  const [processing, setProcessing] = useState(false);
  const [migrationMode, setMigrationMode] = useState<'debts' | 'pagopa'>('debts');
  const [existingPagopaLinks, setExistingPagopaLinks] = useState<any[]>([]);
  
  // RQ options for PagoPA migration (loaded via RPC)
  const [rqOptions, setRqOptions] = useState<RqLight[]>([]);
  const [rqLoading, setRqLoading] = useState(false);

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

  // Cleanup invalid selections when RQ options change
  useEffect(() => {
    if (migrationMode !== 'pagopa') return;
    const valid = new Set(rqOptions.map(r => r.id));
    setSelectedRqIds(prev => prev.filter(id => valid.has(id)));
  }, [rqOptions, migrationMode]);

  // Clear RQ selections when switching away from pagopa mode
  useEffect(() => {
    if (migrationMode !== 'pagopa') setSelectedRqIds([]);
  }, [migrationMode]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (migrationMode === 'pagopa') {
        // Load migratable PagoPA for PagoPA → RQ migration (NO getRiamQuaterOptions)
        const pagopaData = await getMigrablePagopaForRateation(rateation.id);
        
        setMigrablePagoPA(pagopaData);
        
        // Auto-select the current PagoPA if it's migratable
        if (pagopaData.length > 0) {
          // Auto-select the current rateation if it's in the list and nothing is selected
          const firstId = Number(pagopaData[0].id);
          if (Number.isSafeInteger(firstId)) {
            setSelectedPagopaIds(prev => prev.length ? prev : [firstId]);
          } else {
            console.warn('[WARN] pagopaData[0].id non numerico:', pagopaData[0].id);
          }
        }
      } else {
        // Load debts for normal debt migration
        const [debtsData, rqData] = await Promise.all([
          fetchActiveDebtsForRateation(rateation.id),
          getRiamQuaterOptions()
        ]);
        
        setActiveDebts(debtsData);
        setRqRateations((rqData ?? []).map(r => ({ ...r, id: Number(r.id) })));
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

  // Load existing PagoPA links when a PagoPA is selected
  const loadExistingLinks = async (pagopaId: number) => {
    try {
      const links = await getPagopaLinks(pagopaId);
      setExistingPagopaLinks(links);
      return links;
    } catch (error) {
      console.error('Error loading existing links:', error);
      return [];
    }
  };

  const handleDebtSelection = (debtId: string | number, checked: boolean) => {
    const idNum = Number(debtId);
    if (!Number.isSafeInteger(idNum)) {
      console.warn('[WARN] debtId non numerico:', debtId);
      return;
    }
    setSelectedDebtIds(prev => 
      checked 
        ? [...prev, idNum]
        : prev.filter(id => id !== idNum)
    );
  };

  const handlePagopaSelection = async (pagopaId: string | number, checked: boolean) => {
    const id = Number(pagopaId);
    
    if (migrationMode === 'pagopa') {
      // ✅ Selezione singola: o l'id selezionato, oppure nessuno
      setSelectedPagopaIds(checked ? [id] : []);
    } else {
      // ✅ Multi-selezione (solo per modalità "debts")
      setSelectedPagopaIds(prev =>
        checked
          ? Array.from(new Set([...prev, id]))
          : prev.filter(x => x !== id)
      );
    }
    
    // Reset target RQ and options when PagoPA selection changes
    setTargetRateationId(null);
    setSelectedRqIds([]);
    setRqOptions([]);
    
    // Load existing links when PagoPA selection changes
    if (checked) {
      try {
        await loadExistingLinks(Number(pagopaId));
      } catch (error) {
        console.error('Error loading PagoPA data:', error);
      }
    } else {
      setExistingPagopaLinks([]);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    // ✅ Disabilita "Seleziona tutti" in modalità pagopa (solo selezione singola)
    if (migrationMode === 'pagopa') return;
    
    // Solo per modalità "debts"
    setSelectedDebtIds(checked ? activeDebts.map(d => Number(d.debt_id)) : []);
  };

  const nothingSelected = migrationMode === 'pagopa'
    ? selectedPagopaIds.length === 0 || selectedRqIds.length === 0
    : selectedDebtIds.length === 0 || !targetRateationId;

  // Calculate selected PagoPA ID as number
  const selectedPagopaIdNumber = useMemo(
    () => selectedPagopaIds[0],
    [selectedPagopaIds]
  );

  // Load RQ options when PagoPA is selected (PagoPA migration mode only)
  useEffect(() => {
    let cancelled = false;
    
    async function loadRqOptions() {
      if (migrationMode !== 'pagopa' || !selectedPagopaIdNumber) {
        setRqOptions([]);
        return;
      }
      
      setRqLoading(true);
      try {
        const rows = await fetchSelectableRqForPagopa(selectedPagopaIdNumber);
        if (!cancelled) setRqOptions(rows);
      } catch (error) {
        console.error('Error loading RQ options:', error);
        if (!cancelled) setRqOptions([]);
      } finally {
        if (!cancelled) setRqLoading(false);
      }
    }
    
    loadRqOptions();
    return () => { cancelled = true; };
  }, [selectedPagopaIdNumber, migrationMode]);

  // Disable migrate button logic
  const disableMigrate = processing || nothingSelected;

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
    const numId = Number(id);
    
    // For PagoPA mode, check rqOptions first
    if (migrationMode === 'pagopa') {
      const found = rqOptions.find(r => r.id === numId);
      if (found) return found.number;
    }
    
    // Fallback to rqRateations (for debt mode)
    const found = rqRateations.find(r => r.id === numId);
    return found?.number ?? String(id).slice(-6);
  };

  const handleUnlinkPagopa = async (pagopaId: number, rqId: number, rqNumber: string) => {
    if (!confirm(`Sganciare la PagoPA da RQ ${rqNumber}?`)) return;
    
    setProcessing(true);
    try {
      const unlocked = await undoPagopaLinks(pagopaId, [rqId]);
      
      toast({
        title: "Collegamento rimosso",
        description: unlocked
          ? 'PagoPA sbloccata: stato ripristinato ad ATTIVA'
          : `Scollegata da RQ ${rqNumber}`,
      });
      
      // Ricarica i dati completi e aggiorna KPI
      await Promise.all([
        loadExistingLinks(pagopaId),
        loadData()
      ]);
      
      // Trigger KPI refresh
      window.dispatchEvent(new CustomEvent('rateations:reload-kpis'));
      onMigrationComplete?.();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Impossibile sganciare",
        variant: "destructive"
      });
    } finally {
      setProcessing(false);
    }
  };

  // Custom close handler to reset all selections
  const onClose = (open: boolean) => {
    setOpen(open);
    if (!open) {
      // Reset selections when dialog closes
      setSelectedPagopaIds([]);
      setSelectedDebtIds([]);
      setTargetRateationId(null);
      setSelectedRqIds([]);
      setNote('');
      setExistingPagopaLinks([]);
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

    if (migrationMode === 'pagopa') {
      // NUOVA: Migrazione atomica PagoPA → RQ con multi-selezione RQ
      setProcessing(true);
      try {
        if (!selectedPagopaIds.length || !selectedRqIds.length) {
          throw new Error('Seleziona una PagoPA e almeno una RQ');
        }

        const pagopaIdNum = selectedPagopaIds[0];
        const rqIdsNum = selectedRqIds;

        // Debug logging to trace exact values being sent
        console.debug('[DBG] selectedPagopaIds:', selectedPagopaIds, 'selectedRqIds:', selectedRqIds);
        console.debug('[MIGRATE] p_pagopa_id:', pagopaIdNum, 'p_rq_ids:', rqIdsNum);

        // Use the new atomic RPC: migratePagopaAttachRq
        await migratePagopaAttachRq(
          pagopaIdNum,
          rqIdsNum,
          note.trim() || undefined
        );

        const rqLabels = rqIdsNum.map(id => rqLabel(id)).join(', ');
        toast({
          title: "Migrazione completata", 
          description: `PagoPA collegata a ${rqIdsNum.length} RQ: ${rqLabels}. Stato: INTERROTTA`,
          duration: 5000
        });

        // Reload and refresh
        await loadData();
        window.dispatchEvent(new CustomEvent('rateations:reload-kpis'));

        setOpen(false);
        onMigrationComplete?.();
        
        // Reset form
        setSelectedPagopaIds([]);
        setSelectedRqIds([]);
        setNote('');
      } catch (error) {
        console.error('PagoPA migration error:', error);
        const errorMessage = error instanceof Error ? error.message : "Errore durante la migrazione PagoPA";
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
      if (!targetRateationId || !Number.isSafeInteger(targetRateationId)) {
        toast({
          title: "Piano RQ non selezionato",
          description: "Seleziona il piano Riam.Quater di destinazione",
          variant: "destructive"
        });
        return;
      }
      
      setProcessing(true);
      try {
        await migrateDebtsToRQ({
          sourceRateationId: rateation.id,
          debtIds: selectedDebtIds.map(String),
          targetRateationId: String(targetRateationId),
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
        setTargetRateationId(null);
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
                    {migrationMode !== 'pagopa' && (
                      <Checkbox
                        checked={selectedDebtIds.length === activeDebts.length && activeDebts.length > 0}
                        onCheckedChange={handleSelectAll}
                        disabled={activeDebts.length === 0}
                      />
                    )}
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
                          {migrablePagoPA.map((pagopa) => {
                            const isSelected = selectedPagopaIds.includes(Number(pagopa.id));
                            const isSingleModeAndOtherSelected = migrationMode === 'pagopa' && selectedPagopaIds.length > 0 && !isSelected;
                            
                            return (
                              <div key={pagopa.id} className="flex items-center space-x-2 p-2 border rounded hover:bg-muted/50 transition-colors">
                                {migrationMode === 'pagopa' ? (
                                  <input
                                    type="radio"
                                    name="pagopa-migrate"
                                    id={`pagopa-${pagopa.id}`}
                                    checked={isSelected}
                                    onChange={(e) => handlePagopaSelection(pagopa.id, e.target.checked)}
                                    className="h-4 w-4 shrink-0 rounded-full border border-primary text-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer"
                                  />
                                ) : (
                                  <Checkbox
                                    id={`pagopa-${pagopa.id}`}
                                    checked={isSelected}
                                    onCheckedChange={(checked) => handlePagopaSelection(pagopa.id, checked as boolean)}
                                  />
                                )}
                                <label htmlFor={`pagopa-${pagopa.id}`} className="flex-1 min-w-0 cursor-pointer">
                                   <div className="font-medium text-sm truncate">
                                     {pagopa.number} - {pagopa.taxpayer_name}
                                     <Badge variant="secondary" className="ml-2 text-xs">
                                       {pagopa.status}
                                     </Badge>
                                   </div>
                                   {pagopa.allocatable_cents && (
                                     <div className="text-xs text-muted-foreground flex items-center gap-2">
                                       <span className="text-green-600">
                                         Disponibile: €{(pagopa.allocatable_cents / 100).toFixed(2)}
                                       </span>
                                     </div>
                                   )}
                                </label>
                                {pagopa.total_amount && (
                                  <div className="text-sm text-right flex-shrink-0">
                                    €{pagopa.total_amount.toFixed(2)}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                         </div>
                          </div>
                          
                          {/* Existing PagoPA Links */}
                          {existingPagopaLinks.length > 0 && selectedPagopaIds.length > 0 && (
                            <Card className="bg-amber-50 border-amber-200">
                              <CardHeader className="pb-3">
                                <CardTitle className="text-sm text-amber-800">Collegamenti esistenti</CardTitle>
                              </CardHeader>
                              <CardContent className="pt-0">
                                <ul className="space-y-2">
                                  {existingPagopaLinks.map((link: any) => (
                                    <li key={link.riam_quater_id} className="flex items-center justify-between p-2 bg-white rounded border border-amber-200">
                                       <div className="text-sm">
                                        <span className="font-medium text-foreground">
                                          RQ {link.rq?.number || link.riam_quater_id}
                                        </span>
                                        {link.rq?.taxpayer_name && (
                                          <span className="text-muted-foreground"> — {link.rq.taxpayer_name}</span>
                                        )}
                                      </div>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
                                        disabled={processing}
                                        onClick={() => handleUnlinkPagopa(
                                          Number(selectedPagopaIds[0]), 
                                          link.riam_quater_id, 
                                          link.rq?.number || link.riam_quater_id
                                        )}
                                      >
                                        Sgancia
                                      </Button>
                                    </li>
                                  ))}
                                </ul>
                              </CardContent>
                            </Card>
                          )}
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
                              checked={selectedDebtIds.includes(Number(item.debt_id))}
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
                    {migrationMode === 'pagopa' ? 'Rateazioni RQ di Destinazione' : 'Rateazione di Destinazione'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="target-rateation">
                        {migrationMode === 'pagopa' ? 'Seleziona Piani RQ per la Migrazione' : 'Seleziona Piano RQ'}
                      </Label>
                      
                      {migrationMode === 'pagopa' ? (
                        // Multi-select checkbox list for PagoPA mode
                        <div className="space-y-2 max-h-64 overflow-auto border rounded-lg p-2">
                          {rqLoading ? (
                            <div className="text-sm text-muted-foreground px-2 py-1">Caricamento RQ…</div>
                          ) : rqOptions.length === 0 ? (
                            <div className="text-sm text-muted-foreground px-2 py-1">
                              {selectedPagopaIds.length === 0 
                                ? 'Seleziona prima una PagoPA' 
                                : 'Nessuna RQ disponibile per questa PagoPA'}
                            </div>
                          ) : (
                            rqOptions.map(rq => {
                              const isChecked = selectedRqIds.includes(rq.id);
                              const inputId = `rq-${rq.id}`;
                              return (
                                <label 
                                  key={rq.id}
                                  htmlFor={inputId}
                                  className="flex items-center gap-2 px-2 py-1 hover:bg-muted rounded-md cursor-pointer"
                                  aria-label={`Seleziona RQ ${rq.number || rq.id}${rq.taxpayer_name ? ` — ${rq.taxpayer_name}` : ''}`}
                                >
                                  <input
                                    id={inputId}
                                    type="checkbox"
                                    className="h-4 w-4 rounded border-primary"
                                    disabled={rqLoading || processing}
                                    checked={isChecked}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setSelectedRqIds(prev =>
                                        checked 
                                          ? Array.from(new Set([...prev, rq.id])) 
                                          : prev.filter(x => x !== rq.id)
                                      );
                                    }}
                                  />
                                  <span className="text-sm">
                                    {rq.number || rq.id} {rq.taxpayer_name ? `— ${rq.taxpayer_name}` : ''}
                                  </span>
                                </label>
                              );
                            })
                          )}
                          {!rqLoading && rqOptions.length > 0 && (
                            <div aria-live="polite" className="text-xs text-muted-foreground mt-1 px-2">
                              {selectedRqIds.length > 0 ? `Selezionate ${selectedRqIds.length} RQ` : 'Nessuna RQ selezionata'}
                            </div>
                          )}
                        </div>
                      ) : (
                        // Single select for debt mode
                        <Select 
                          value={targetRateationId ? String(targetRateationId) : ''} 
                          onValueChange={(val) => setTargetRateationId(val ? Number(val) : null)}
                        >
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
                      )}
                      
                      {migrationMode === 'pagopa' && selectedRqIds.length > 0 && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Selezionate {selectedRqIds.length} RQ
                        </div>
                      )}
                      
                      {migrationMode !== 'pagopa' && !targetRateationId && selectedDebtIds.length > 0 && (
                        <p className="text-xs text-destructive">
                          Seleziona la Riam.Quater per confermare la migrazione
                        </p>
                      )}
                      
                      {migrationMode !== 'pagopa' && rqRateations.length === 0 && (
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
          <Button onClick={handleMigration} disabled={disableMigrate} data-testid="rq-migrate-btn">
            {processing && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>}
            {processing 
              ? 'Migrazione...' 
              : migrationMode === 'pagopa' 
                ? `Migra a ${selectedRqIds.length} RQ`.trim()
                : `Migra ${selectedDebtIds.length > 0 ? selectedDebtIds.length : ''} cartelle`.trim()
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};