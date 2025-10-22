import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client-resilient";
import { FileText, Trash2, Edit, Calendar, Printer, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { NoteDrawer } from "./NoteDrawer";
import { useToast } from "@/hooks/use-toast";
import { generateNotesPDF } from "@/utils/notes-pdf";

interface RateationNote {
  id: number;
  numero: string | null;
  tipo: string | null;
  contribuente: string | null;
  importo_totale: number | null;
  notes: string;
  updated_at: string;
}

export function RecentNotesCard() {
  const [notes, setNotes] = useState<RateationNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<RateationNote | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedForEdit, setSelectedForEdit] = useState<RateationNote | null>(null);
  const [printingAll, setPrintingAll] = useState(false);
  const { toast } = useToast();

  const loadNotes = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('v_rateations_list_ui')
        .select('id, numero, tipo, contribuente, importo_totale, notes, updated_at')
        .not('notes', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setNotes(data || []);
    } catch (error) {
      console.error('[RecentNotesCard] Error loading notes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotes();

    // Listen for note updates
    const handleNoteUpdate = () => loadNotes();
    window.addEventListener('rateations:reload-kpis', handleNoteUpdate);
    return () => window.removeEventListener('rateations:reload-kpis', handleNoteUpdate);
  }, []);

  const handleDeleteClick = (note: RateationNote) => {
    setSelectedForDelete(note);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedForDelete) return;

    try {
      const { error } = await supabase
        .from('rateations')
        .update({ notes: null })
        .eq('id', selectedForDelete.id);

      if (error) throw error;

      // Refresh list (card will disappear)
      loadNotes();
      setDeleteDialogOpen(false);
      setSelectedForDelete(null);

    } catch (error) {
      console.error('[RecentNotesCard] Error deleting note:', error);
      toast({
        title: "Errore",
        description: "Impossibile cancellare la nota. Riprova.",
        variant: "destructive",
      });
    }
  };

  const handleEditClick = (note: RateationNote) => {
    setSelectedForEdit(note);
    setDrawerOpen(true);
  };

  const handlePrintAll = async () => {
    setPrintingAll(true);
    try {
      await generateNotesPDF(notes);
    } catch (error) {
      console.error('[RecentNotesCard] Error generating PDF:', error);
      toast({
        title: "Errore",
        description: "Impossibile generare il PDF. Riprova.",
        variant: "destructive",
      });
    } finally {
      setPrintingAll(false);
    }
  };

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Note Recenti
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (notes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Note Recenti
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            Nessuna nota presente. Aggiungi note alle rateazioni per vederle qui.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Note Recenti ({notes.length})
          </CardTitle>
          <Button 
            variant="outline" 
            size="sm"
            onClick={handlePrintAll}
            disabled={printingAll}
          >
            {printingAll ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Printer className="h-4 w-4 mr-2" />
                Stampa tutte
              </>
            )}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {notes.map((note) => (
            <div 
              key={note.id}
              className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="flex justify-between items-start mb-2">
                <div 
                  className="flex-1 cursor-pointer" 
                  onClick={() => handleEditClick(note)}
                >
                  <h4 className="font-medium text-sm">
                    {note.numero} • {note.contribuente}
                  </h4>
                </div>
                
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleDeleteClick(note)}
                    title="Elimina nota"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleEditClick(note)}
                    title="Modifica nota"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <p 
                className="text-sm text-muted-foreground line-clamp-2 cursor-pointer mb-2"
                onClick={() => handleEditClick(note)}
              >
                {note.notes}
              </p>
              
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDateTime(note.updated_at)}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vuoi cancellare questa nota?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              {selectedForDelete && (
                <>
                  <p>
                    Rateazione: <strong>{selectedForDelete.numero}</strong> - {selectedForDelete.contribuente}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    ⚠️ Questa azione non può essere annullata.
                  </p>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Conferma cancellazione
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Drawer */}
      {selectedForEdit && (
        <NoteDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          rateation={selectedForEdit}
          onRefresh={loadNotes}
        />
      )}
    </>
  );
}
