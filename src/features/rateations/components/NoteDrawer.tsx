import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client-resilient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface NoteDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rateation: {
    id: number;
    numero: string | null;
    tipo: string | null;
    contribuente: string | null;
    importo_totale: number | null;
    notes: string | null;
  };
  onRefresh?: () => void;
}

export function NoteDrawer({ open, onOpenChange, rateation, onRefresh }: NoteDrawerProps) {
  const [notes, setNotes] = useState(rateation.notes || "");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Reset notes when rateation changes
  useEffect(() => {
    setNotes(rateation.notes || "");
  }, [rateation.notes, open]);

  const handleSave = async () => {
    if (!supabase) {
      toast({
        title: "Errore",
        description: "Supabase non configurato",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    
    try {
      const { error } = await supabase
        .from('rateations')
        .update({ 
          notes: notes.trim() || null
        })
        .eq('id', rateation.id);
      
      if (error) throw error;
      
      onRefresh?.();
      onOpenChange(false);
      
    } catch (error) {
      console.error('[NoteDrawer] Error saving note:', error);
      toast({
        title: "Errore",
        description: "Impossibile salvare la nota. Riprova.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="border-b">
          <DrawerTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Nota Rateazione
          </DrawerTitle>
          <DrawerDescription className="space-y-2 text-left">
            <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
              {rateation.numero && (
                <div>
                  <span className="text-muted-foreground">Numero:</span>
                  <span className="ml-2 font-semibold">{rateation.numero}</span>
                </div>
              )}
              {rateation.tipo && (
                <div>
                  <span className="text-muted-foreground">Tipo:</span>
                  <Badge variant="secondary" className="ml-2">{rateation.tipo}</Badge>
                </div>
              )}
              {rateation.contribuente && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Contribuente:</span>
                  <span className="ml-2 font-semibold">{rateation.contribuente}</span>
                </div>
              )}
              {rateation.importo_totale && (
                <div>
                  <span className="text-muted-foreground">Importo:</span>
                  <span className="ml-2 font-semibold">
                    €{rateation.importo_totale.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
            </div>
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 py-6 overflow-y-auto flex-1">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Inserisci note o promemoria per questa rateazione..."
            className="min-h-[200px] resize-none"
            maxLength={2000}
          />
          <p className="text-xs text-muted-foreground mt-2">
            {notes.length}/2000 caratteri
          </p>
        </div>

        <DrawerFooter className="border-t">
          <div className="flex gap-2 w-full">
            <DrawerClose asChild>
              <Button variant="outline" className="flex-1" disabled={saving}>
                Annulla
              </Button>
            </DrawerClose>
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvataggio...
                </>
              ) : (
                "Salva"
              )}
            </Button>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
