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
import { eurToCentsForAllocation } from '@/lib/utils/rq-allocation';
import { safeParseAllocation, isQuotaInRange } from '@/lib/utils/rq-allocation-ui';
import { useSelectableRq } from '@/features/rateations/hooks/useSelectableRq';
import { fetchPagopaQuotaInfo, fetchSelectableRqForPagopa, RqLight, unlockPagopaIfNoLinks } from '@/integrations/supabase/api/rq';
import { supabase } from '@/integrations/supabase/client';
import type { PagopaQuotaInfo } from '@/integrations/supabase/api/rq';

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
  const [allocationQuotaEur, setAllocationQuotaEur] = useState<string>('');
  const [allocInfo, setAllocInfo] = useState<PagopaQuotaInfo>({ residualCents: 0, allocatedCents: 0, allocatableCents: 0 });
  const [existingPagopaLinks, setExistingPagopaLinks] = useState<any[]>([]);

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
          setSelectedPagopaIds(prev => prev.length ? prev : [String(pagopaData[0].id)]);
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

  // Self-healing: sblocca automaticamente PagoPA se quota 0 ma nessun link
  const attemptSelfHeal = async (pagopaId: number, currentAlloc: PagopaQuotaInfo) => {
    if (currentAlloc.allocatableCents === 0 && 
        currentAlloc.residualCents > 0 && 
        existingPagopaLinks.length === 0) {
      console.log(`🔧 Self-healing: Attempting to unlock PagoPA ${pagopaId}`);
      try {
        const unlocked = await unlockPagopaIfNoLinks(pagopaId);
        if (unlocked) {
          console.log(`✅ Self-healing: PagoPA ${pagopaId} unlocked successfully`);
          // Re-fetch quota after unlock
          const newAlloc = await fetchPagopaQuotaInfo(pagopaId);
          setAllocInfo(newAlloc);
          console.log(`🎯 Self-healing: Updated quota to ${newAlloc.allocatableCents} cents`);
          return true;
        }
      } catch (error) {
        console.error('Self-healing failed:', error);
      }
    }
    return false;
  };

  const handleDebtSelection = (debtId: string, checked: boolean) => {
    setSelectedDebtIds(prev => 
      checked 
        ? [...prev, debtId]
        : prev.filter(id => id !== debtId)
    );
  };

  const handlePagopaSelection = async (pagopaId: string | number, checked: boolean) => {
    const id = String(pagopaId);
    setSelectedPagopaIds(prev => 
      checked 
        ? Array.from(new Set([...prev, id]))
        : prev.filter(x => x !== id)
    );
    
    // FASE 3.2: Load existing links and quota info when PagoPA selection changes
    if (checked) {
      try {
        // Load existing links for this PagoPA
        const links = await loadExistingLinks(Number(pagopaId));
        
        // Load quota info using the robust RPC
        const quotaInfo = await fetchPagopaQuotaInfo(Number(pagopaId));
        setAllocInfo(quotaInfo);
        
        // Attempt self-healing if needed
        await attemptSelfHeal(Number(pagopaId), quotaInfo);
      } catch (error) {
        console.error('Error loading PagoPA data:', error);
      }
    } else {
      // Reset quando PagoPA viene deselezionata per evitare inconsistenze
      setTargetRateationId('');
      setAllocInfo({ residualCents: 0, allocatedCents: 0, allocatableCents: 0 });
      setAllocationQuotaEur('');
      setExistingPagopaLinks([]);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (migrationMode === 'pagopa') {
      setSelectedPagopaIds(checked ? migrablePagoPA.map(p => String(p.id)) : []);
    } else {
      setSelectedDebtIds(checked ? activeDebts.map(d => d.debt_id) : []);
    }
  };

  const nothingSelected = migrationMode === 'pagopa'
    ? selectedPagopaIds.length === 0
    : selectedDebtIds.length === 0;

  // FASE 3.2: Use RQ available hook (DB-side with client fallback)
  const selectedPagopaIdNumber = selectedPagopaIds.length ? Number(selectedPagopaIds[0]) : null;
  const linkedRqIds = existingPagopaLinks.map((l: any) => Number(l.riam_quater_id));
  const rqLightData: RqLight[] = rqRateations.map(r => ({
    id: Number(r.id),
    number: String(r.number ?? ''),
    taxpayer_name: r.taxpayer_name ?? null,
    quater_total_due_cents: 0, // Will be fetched by the RPC if needed
  }));
  const { selectableRq, loading: selectableLoading } = useSelectableRq(
    selectedPagopaIdNumber,
    rqLightData,
    linkedRqIds
  );

  // FASE 3.2: Quota disponibile dalla RPC
  useEffect(() => {
    if (!selectedPagopaIdNumber) { 
      setAllocInfo({ residualCents: 0, allocatedCents: 0, allocatableCents: 0 }); 
      return; 
    }
    
    fetchPagopaQuotaInfo(selectedPagopaIdNumber)
      .then(info => setAllocInfo(info))
      .catch(() => setAllocInfo({ residualCents: 0, allocatedCents: 0, allocatableCents: 0 }));
  }, [selectedPagopaIdNumber]);

  // Safe UI parsing - never throws during render
  const { cents: quotaCents, valid: quotaInputValid } = useMemo(
    () => safeParseAllocation(allocationQuotaEur),
    [allocationQuotaEur]
  );
  
  // FASE 3.2: Condizioni semplificate per abilitare il bottone "Migra"
  const disableMigrate = !selectedPagopaIdNumber || 
                        !targetRateationId || 
                        processing ||
                        (migrationMode === 'pagopa' && (
                          quotaCents <= 0 || 
                          quotaCents > allocInfo.allocatableCents
                        )) ||
                        (migrationMode === 'debts' && nothingSelected);

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
      
      // Ricarica i dati completi
      await Promise.all([
        loadExistingLinks(pagopaId),
        loadData()
      ]);
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
      setTargetRateationId('');
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

    if (!targetRateationId) {
      toast({
        title: "Piano RQ non selezionato",
        description: "Seleziona il piano Riam.Quater di destinazione",
        variant: "destructive"
      });
      return;
    }

    if (migrationMode === 'pagopa') {
      // Strict validation at submit
      let quotaCents: number;
      try {
        quotaCents = eurToCentsForAllocation(allocationQuotaEur);
      } catch {
        toast({ 
          title: 'Quota non valida', 
          description: 'Inserire un importo valido', 
          variant: 'destructive' 
        });
        return;
      }

      if (quotaCents <= 0 || quotaCents > allocInfo.allocatableCents) {
        const maxEur = (allocInfo.allocatableCents / 100).toFixed(2);
        toast({ 
          title: 'Quota non valida', 
          description: `La quota deve essere tra €0,01 e €${maxEur}`, 
          variant: 'destructive' 
        });
        return;
      }
    }

    if (migrationMode === 'pagopa') {
      // NUOVA: Migrazione atomica PagoPA → RQ (senza allocazione per quote)
      // Seleziona UNA PagoPA e una o più RQ, poi collega atomicamente
      setProcessing(true);
      try {
        if (!selectedPagopaIds.length || !targetRateationId) {
          throw new Error('Seleziona una PagoPA e almeno una RQ');
        }

        // Usa la nuova RPC atomica: migratePagopaAttachRq
        await migratePagopaAttachRq(
          selectedPagopaIds[0], // Solo la prima PagoPA selezionata
          [targetRateationId], // Array di RQ (per ora solo una)
          note.trim() || undefined
        );

        toast({
          title: "Migrazione completata", 
          description: `PagoPA collegata a RQ ${rqLabel(targetRateationId)}. Stato: INTERROTTA`,
          duration: 5000
        });

        // Reload and refresh
        await loadData();
        window.dispatchEvent(new CustomEvent('rateations:reload-kpis'));

        setOpen(false);
        onMigrationComplete?.();
        
        // Reset form
        setSelectedPagopaIds([]);
        setTargetRateationId('');
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
                                 {pagopa.allocatable_cents && (
                                   <div className="text-xs text-muted-foreground flex items-center gap-2">
                                     <span className="text-green-600">
                                       Disponibile: €{(pagopa.allocatable_cents / 100).toFixed(2)}
                                     </span>
                                   </div>
                                 )}
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
                         
                         {/* Quota allocation input for PagoPA mode */}
                         {selectedPagopaIds.length > 0 && (
                           <Card className="bg-blue-50 border-blue-200">
                             <CardContent className="p-4">
                                <Label htmlFor="quota-input" className="text-sm font-medium">
                                  Quota da attribuire a questa RQ
                                </Label>
                                <div className="flex gap-2 mt-2">
                                  <div className="relative flex-1">
                                    <Euro className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                     <Input
                                       id="quota-input"
                                       data-testid="rq-quota-input"
                                       type="text"
                                       inputMode="decimal"
                                       pattern="[0-9\.,]*"
                                       value={allocationQuotaEur}
                                       onChange={(e) => setAllocationQuotaEur(e.target.value)}
                                       onKeyDown={(e) => {
                                         if (e.key === 'Enter' && disableMigrate) e.preventDefault();
                                       }}
                                       className="pl-9"
                                       placeholder="0,00"
                                       disabled={allocInfo.allocatableCents === 0}
                                       aria-invalid={!quotaInputValid}
                                       aria-describedby="quota-help quota-error"
                                     />
                                   </div>
                                   <Button
                                     type="button"
                                     variant="secondary"
                                     size="sm"
                                     data-testid="rq-use-all"
                                      onClick={() => setAllocationQuotaEur((allocInfo.allocatableCents/100).toLocaleString('it-IT', {minimumFractionDigits:2}))}
                                      disabled={allocInfo.allocatableCents === 0 || processing}
                                   >
                                     Usa tutto
                                   </Button>
                                </div>
                                <small id="quota-help" className="text-xs text-muted-foreground mt-1 block">
                                   {allocInfo.allocatableCents === 0
                                     ? 'Nessuna quota disponibile: sgancia o riduci una quota esistente'
                                     : <>Massimo disponibile: €{(allocInfo.allocatableCents / 100).toLocaleString('it-IT', {minimumFractionDigits:2})}</>}
                                </small>
                                 {allocationQuotaEur && allocInfo.allocatableCents > 0 && (
                                   <>
                                     {!quotaInputValid && (
                                       <div id="quota-error" role="alert" aria-live="polite" className="text-xs text-destructive mt-1">
                                         Inserire un importo valido
                                       </div>
                                     )}
                                     {quotaInputValid && !isQuotaInRange(quotaCents, allocInfo.allocatableCents) && (
                                       <div className="text-xs text-destructive mt-1" role="alert" aria-live="polite">
                                         La quota deve essere tra €0,01 e €{(allocInfo.allocatableCents/100).toLocaleString('it-IT', {minimumFractionDigits:2})}
                                       </div>
                                     )}
                                   </>
                                 )}
                             </CardContent>
                            </Card>
                          )}
                          
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
                                        <span className="ml-2 text-muted-foreground">
                                          (€ {(link.allocated_residual_cents / 100).toLocaleString('it-IT', { 
                                            minimumFractionDigits: 2 
                                          })})
                                        </span>
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
                          {selectableRq.length === 0 && migrationMode === 'pagopa' && selectedPagopaIds.length > 0 ? (
                            <div className="p-4 text-center space-y-3">
                              <p className="text-sm text-muted-foreground">
                                Tutte le RQ attive sono già collegate a questa PagoPA.
                              </p>
                              <div className="flex flex-col gap-2">
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="text-xs"
                                  onClick={() => {
                                    // Navigate to create new RQ - placeholder for now
                                    toast({
                                      title: "Funzionalità in arrivo",
                                      description: "Creazione nuova RQ sarà disponibile presto"
                                    });
                                  }}
                                >
                                  Crea nuova RQ
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="text-xs"
                                  onClick={() => {
                                    toast({
                                      title: "Suggerimento",
                                      description: "Sgancia una RQ esistente per liberare slot"
                                    });
                                  }}
                                >
                                  Sgancia una RQ esistente
                                </Button>
                              </div>
                            </div>
                          ) : (
                            selectableRq.map((rq) => (
                              <SelectItem key={rq.id} value={String(rq.id)}>
                                {rq.number ?? '—'} {rq.taxpayer_name ? `- ${rq.taxpayer_name}` : ''}
                              </SelectItem>
                            ))
                          )}
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
                       {migrationMode === 'pagopa' && selectedPagopaIds.length > 0 && selectableRq.length === 0 && rqRateations.length > 0 && (
                         <p className="text-xs text-amber-600">
                           Tutte le RQ disponibili sono già collegate a questa PagoPA. Sgancia una RQ esistente o crea una nuova RQ.
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
                ? `Migra ${selectedPagopaIds.length > 0 ? selectedPagopaIds.length : ''} PagoPA`.trim()
                : `Migra ${selectedDebtIds.length > 0 ? selectedDebtIds.length : ''} cartelle`.trim()
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};