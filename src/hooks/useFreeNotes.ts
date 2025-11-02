import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type FreeNote = Database['public']['Tables']['free_notes']['Row'];
type FreeNoteInsert = Database['public']['Tables']['free_notes']['Insert'];
type FreeNoteUpdate = Database['public']['Tables']['free_notes']['Update'];

export function useFreeNotes() {
  const queryClient = useQueryClient();

  // Fetch free notes
  const { data: notes, isLoading, error, refetch } = useQuery({
    queryKey: ['free-notes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('free_notes')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data as FreeNote[];
    }
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (note: { title: string; content: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('free_notes')
        .insert([{ 
          title: note.title,
          content: note.content,
          owner_uid: user.id 
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data as FreeNote;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['free-notes'] });
      toast.success('Promemoria creato con successo');
    },
    onError: (error: Error) => {
      console.error('Error creating free note:', error);
      toast.error('Errore nella creazione del promemoria');
    }
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & FreeNoteUpdate) => {
      const { data, error } = await supabase
        .from('free_notes')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as FreeNote;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['free-notes'] });
      toast.success('Promemoria aggiornato con successo');
    },
    onError: (error: Error) => {
      console.error('Error updating free note:', error);
      toast.error('Errore nell\'aggiornamento del promemoria');
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('free_notes')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['free-notes'] });
      toast.success('Promemoria eliminato con successo');
    },
    onError: (error: Error) => {
      console.error('Error deleting free note:', error);
      toast.error('Errore nell\'eliminazione del promemoria');
    }
  });

  return {
    notes: notes || [],
    isLoading,
    error,
    refetch,
    create: createMutation.mutate,
    update: updateMutation.mutate,
    delete: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending
  };
}
