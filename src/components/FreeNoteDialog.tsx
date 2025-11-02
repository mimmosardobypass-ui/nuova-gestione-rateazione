import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { freeNoteSchema, type FreeNoteFormData } from '@/schemas/FreeNote.schema';
import type { Database } from '@/integrations/supabase/types';

type FreeNote = Database['public']['Tables']['free_notes']['Row'];

interface FreeNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  note?: FreeNote | null;
  onSave: (data: { title: string; content: string }, id?: string) => void;
  isSaving: boolean;
}

export function FreeNoteDialog({ 
  open, 
  onOpenChange, 
  mode, 
  note, 
  onSave,
  isSaving 
}: FreeNoteDialogProps) {
  const [titleLength, setTitleLength] = useState(0);
  const [contentLength, setContentLength] = useState(0);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch
  } = useForm<FreeNoteFormData>({
    resolver: zodResolver(freeNoteSchema),
    defaultValues: {
      title: note?.title || '',
      content: note?.content || ''
    }
  });

  const title = watch('title');
  const content = watch('content');

  useEffect(() => {
    setTitleLength(title?.length || 0);
  }, [title]);

  useEffect(() => {
    setContentLength(content?.length || 0);
  }, [content]);

  useEffect(() => {
    if (open && note && mode === 'edit') {
      reset({
        title: note.title,
        content: note.content
      });
    } else if (open && mode === 'create') {
      reset({
        title: '',
        content: ''
      });
    }
  }, [open, note, mode, reset]);

  const onSubmit = (data: FreeNoteFormData) => {
    // Zod ensures these are defined and valid
    const validatedData = {
      title: data.title,
      content: data.content
    };
    
    if (mode === 'edit' && note) {
      onSave(validatedData, note.id);
    } else {
      onSave(validatedData);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Nuovo Promemoria' : 'Modifica Promemoria'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="title">Titolo</Label>
              <span className="text-xs text-muted-foreground">
                {titleLength}/100
              </span>
            </div>
            <Input
              id="title"
              {...register('title')}
              placeholder="Es: Chiamare commercialista"
              disabled={isSaving}
              className={errors.title ? 'border-destructive' : ''}
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="content">Contenuto</Label>
              <span className="text-xs text-muted-foreground">
                {contentLength}/2000
              </span>
            </div>
            <Textarea
              id="content"
              {...register('content')}
              placeholder="Inserisci il contenuto del promemoria..."
              rows={6}
              disabled={isSaving}
              className={errors.content ? 'border-destructive' : ''}
            />
            {errors.content && (
              <p className="text-sm text-destructive">{errors.content.message}</p>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Annulla
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salva
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
