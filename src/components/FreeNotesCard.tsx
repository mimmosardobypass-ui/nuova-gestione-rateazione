import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Pencil, Trash2, Loader2, Plus, Printer } from 'lucide-react';
import { formatDistance } from 'date-fns';
import { it } from 'date-fns/locale';
import { useFreeNotes } from '@/hooks/useFreeNotes';
import { FreeNoteDialog } from './FreeNoteDialog';
import { generateFreeNotesPDF } from '@/utils/notes-pdf';
import type { Database } from '@/integrations/supabase/types';

type FreeNote = Database['public']['Tables']['free_notes']['Row'];

export function FreeNotesCard() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [selectedNote, setSelectedNote] = useState<FreeNote | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);

  // Chiamare hook direttamente senza try-catch (React Rules of Hooks)
  const { 
    notes, 
    isLoading, 
    error,
    create, 
    update, 
    delete: deleteNote, 
    isCreating, 
    isUpdating, 
    isDeleting 
  } = useFreeNotes();

  const handleCreate = () => {
    setDialogMode('create');
    setSelectedNote(null);
    setDialogOpen(true);
  };

  const handleEdit = (note: FreeNote) => {
    setDialogMode('edit');
    setSelectedNote(note);
    setDialogOpen(true);
  };

  const handleSave = (data: { title: string; content: string }, id?: string) => {
    if (dialogMode === 'edit' && id) {
      update({ id, ...data });
    } else {
      create(data);
    }
    setDialogOpen(false);
    setSelectedNote(null);
  };

  const handleDeleteClick = (id: string) => {
    setNoteToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (noteToDelete) {
      deleteNote(noteToDelete);
      setDeleteDialogOpen(false);
      setNoteToDelete(null);
    }
  };

  const handlePrintAll = () => {
    if (notes.length > 0) {
      generateFreeNotesPDF(notes);
    }
  };

  const truncateContent = (content: string, maxLines: number = 2) => {
    const lines = content.split('\n');
    if (lines.length > maxLines) {
      return lines.slice(0, maxLines).join('\n') + '...';
    }
    return content;
  };

  // Sempre renderizzare la card, anche in caso di errore
  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center gap-2">
            <CardTitle>📝 Promemoria</CardTitle>
            {notes.length > 0 && (
              <Badge variant="secondary">{notes.length}</Badge>
            )}
          </div>
          <div className="flex gap-2">
            {notes.length > 0 && !error && (
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrintAll}
                className="gap-2"
              >
                <Printer className="h-4 w-4" />
                Stampa tutte
              </Button>
            )}
            <Button onClick={handleCreate} size="sm" className="gap-2" disabled={!!error}>
              <Plus className="h-4 w-4" />
              Promemoria
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {error ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="mb-2">⚠️ Errore nel caricamento</p>
              <p className="text-xs">Verifica la connessione al database</p>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : notes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nessun promemoria presente
            </div>
          ) : (
            <div className="space-y-3">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer group"
                  onClick={() => handleEdit(note)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm mb-1 truncate">
                        {note.title}
                      </h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-2">
                        {truncateContent(note.content, 2)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {formatDistance(new Date(note.updated_at), new Date(), {
                          addSuffix: true,
                          locale: it
                        })}
                      </p>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(note);
                        }}
                        disabled={isUpdating}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClick(note.id);
                        }}
                        disabled={isDeleting}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <FreeNoteDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialogMode}
        note={selectedNote}
        onSave={handleSave}
        isSaving={isCreating || isUpdating}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma eliminazione</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler eliminare questo promemoria? Questa azione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
