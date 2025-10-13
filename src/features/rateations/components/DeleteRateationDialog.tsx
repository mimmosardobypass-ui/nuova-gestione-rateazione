import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2 } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client-resilient";
import { notifyRateationDeleted } from "@/lib/events";
import { useToast } from "@/hooks/use-toast";

interface DeleteRateationDialogProps {
  id: number;
  number?: string | null;
  taxpayer?: string | null;
  disabled?: boolean;
}

export function DeleteRateationDialog({ 
  id, 
  number, 
  taxpayer,
  disabled = false 
}: DeleteRateationDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  async function handleConfirm() {
    setLoading(true);
    
    try {
      const { data, error } = await supabase.rpc("delete_rateation_safely", { 
        p_id: id 
      });
      
      if (error) {
        console.error("[DeleteRateation] RPC error:", error);
        throw new Error(error.message);
      }
      
      // Check RPC response
      if (!data?.ok) {
        const errorCode = data?.error ?? "UNKNOWN";
        let message = "Cancellazione non riuscita.";
        
        switch (errorCode) {
          case "UNAUTHORIZED":
            message = "Sessione scaduta. Effettua nuovamente il login.";
            break;
          case "FORBIDDEN":
            message = "Non hai i permessi per cancellare questa rateazione.";
            break;
          case "NOT_FOUND":
            message = "Rateazione non trovata o già cancellata.";
            break;
          case "INTERNAL_ERROR":
            message = `Errore interno: ${data?.detail ?? "Errore sconosciuto"}`;
            break;
        }
        
        toast({
          title: "Errore",
          description: message,
          variant: "destructive",
        });
        return;
      }
      
      // Success: notify all listeners
      notifyRateationDeleted(id, number ?? undefined);
      
      toast({
        title: "Eliminata",
        description: number 
          ? `Rateazione ${number} cancellata con successo.`
          : "Rateazione cancellata con successo.",
      });
      
      setOpen(false);
      
    } catch (error) {
      console.error("[DeleteRateation] Unexpected error:", error);
      toast({
        title: "Errore",
        description: error instanceof Error 
          ? error.message 
          : "Errore imprevisto durante la cancellazione",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button 
          size="sm" 
          variant="ghost"
          disabled={disabled}
          className="p-1 h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 disabled:opacity-50"
          title={disabled ? "Azione non disponibile" : "Elimina rateazione"}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            Conferma cancellazione
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3 pt-2">
            <p className="text-foreground font-medium">
              Sei sicuro di voler cancellare questa rateazione?
            </p>
            
            {(number || taxpayer) && (
              <div className="mt-3 p-3 bg-muted rounded-lg space-y-1.5">
                {number && (
                  <div className="flex gap-2">
                    <span className="text-muted-foreground font-medium min-w-[80px]">
                      Numero:
                    </span>
                    <span className="font-semibold">{number}</span>
                  </div>
                )}
                {taxpayer && (
                  <div className="flex gap-2">
                    <span className="text-muted-foreground font-medium min-w-[80px]">
                      Contribuente:
                    </span>
                    <span className="font-semibold">{taxpayer}</span>
                  </div>
                )}
              </div>
            )}
            
            <p className="text-xs text-muted-foreground mt-3">
              ⚠️ Questa azione non può essere annullata.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <AlertDialogFooter className="gap-2 sm:gap-2">
          <AlertDialogCancel disabled={loading}>
            Annulla
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Eliminazione...
              </>
            ) : (
              "Conferma eliminazione"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
