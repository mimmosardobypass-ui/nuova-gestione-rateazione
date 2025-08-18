import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatEuro } from "@/lib/formatters";
import { toast } from "@/hooks/use-toast";
import { previewRavvedimento, applyRavvedimento, fetchRavvedimentoProfiles } from "../api/ravvedimento";
import type { InstallmentUI, RavvedimentoCalculation } from "../types";

interface RavvedimentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  installment: InstallmentUI;
  paidAt: string;
  onConfirm: () => void;
}

export function RavvedimentoDialog({
  open,
  onOpenChange,
  installment,
  paidAt,
  onConfirm
}: RavvedimentoDialogProps) {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<string>("");
  const [calculation, setCalculation] = useState<RavvedimentoCalculation | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);

  // Load profiles and calculate preview
  useEffect(() => {
    if (open) {
      loadProfilesAndCalculate();
    }
  }, [open, paidAt]);

  const loadProfilesAndCalculate = async () => {
    try {
      setLoading(true);
      
      // Load profiles
      const profilesData = await fetchRavvedimentoProfiles();
      setProfiles(profilesData);
      
      // Set default profile
      const defaultProfile = profilesData.find(p => p.is_default);
      if (defaultProfile) {
        setSelectedProfile(defaultProfile.id);
      }
      
      // Calculate preview
      await calculatePreview(defaultProfile?.id);
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Errore nel caricamento",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const calculatePreview = async (profileId?: string) => {
    try {
      const result = await previewRavvedimento({
        amountCents: Math.round(installment.amount * 100),
        dueDate: installment.due_date,
        paidAt,
        profileId
      });
      setCalculation(result);
    } catch (error: any) {
      toast({
        title: "Errore calcolo",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleProfileChange = (profileId: string) => {
    setSelectedProfile(profileId);
    calculatePreview(profileId);
  };

  const handleApply = async () => {
    if (!calculation) return;
    
    try {
      setApplying(true);
      
      await applyRavvedimento({
        installmentId: parseInt(installment.seq.toString()), // Convert to installment ID
        paidAt,
        profileId: selectedProfile || undefined
      });
      
      toast({
        title: "Ravvedimento applicato",
        description: `Rata #${installment.seq} aggiornata con penalità e interessi`
      });
      
      onConfirm();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Errore nell'applicazione del ravvedimento",
        variant: "destructive"
      });
    } finally {
      setApplying(false);
    }
  };

  if (loading || !calculation) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Calcolo ravvedimento...</DialogTitle>
          </DialogHeader>
          <div className="py-4">Caricamento...</div>
        </DialogContent>
      </Dialog>
    );
  }

  const showBreakdown = calculation.late_days > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ravvedimento Operoso</DialogTitle>
          <DialogDescription>
            Rata #{installment.seq} - Pagamento in ritardo di {calculation.late_days} giorni
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {profiles.length > 1 && (
            <div className="space-y-2">
              <Label>Profilo ravvedimento</Label>
              <Select value={selectedProfile} onValueChange={handleProfileChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-3 p-4 border rounded-md">
            <div className="flex justify-between">
              <span>Importo originario:</span>
              <span className="font-medium">{formatEuro(installment.amount)}</span>
            </div>
            
            {showBreakdown && (
              <>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Sanzione ravvedimento:</span>
                  <span>+{formatEuro(calculation.penalty_amount_cents / 100)}</span>
                </div>
                
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Interessi legali:</span>
                  <span>+{formatEuro(calculation.interest_amount_cents / 100)}</span>
                </div>
                
                <hr className="my-2" />
              </>
            )}
            
            <div className="flex justify-between text-lg font-semibold">
              <span>Totale da pagare:</span>
              <span>{formatEuro(calculation.paid_total_cents / 100)}</span>
            </div>
          </div>
          
          {calculation.interest_breakdown.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground">
                Dettaglio interessi
              </summary>
              <div className="mt-2 space-y-1">
                {calculation.interest_breakdown.map((period, index) => (
                  <div key={index} className="flex justify-between text-xs">
                    <span>{period.from} - {period.to} ({period.days}gg)</span>
                    <span>{period.annual_percent}% = {formatEuro(period.amount_cents / 100)}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button onClick={handleApply} disabled={applying}>
            {applying ? "Applicando..." : "Conferma pagamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}