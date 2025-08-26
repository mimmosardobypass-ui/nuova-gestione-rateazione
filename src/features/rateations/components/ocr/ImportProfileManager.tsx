import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ParsingProfile } from './types';
import { useToast } from '@/hooks/use-toast';

export interface SavedProfile extends ParsingProfile {
  id: string;
  created_at: string;
  updated_at: string;
}

export const useImportProfileManager = () => {
  const [profiles, setProfiles] = useState<SavedProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const loadProfiles = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('pdf_import_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mappedProfiles: SavedProfile[] = data.map(profile => ({
        id: profile.id,
        name: profile.name,
        columnMappings: profile.column_mappings as ParsingProfile['columnMappings'],
        created_at: profile.created_at,
        updated_at: profile.updated_at,
      }));

      setProfiles(mappedProfiles);
    } catch (error) {
      console.error('Error loading profiles:', error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i profili salvati",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const saveProfile = async (profile: ParsingProfile): Promise<string | null> => {
    try {
      const { data, error } = await supabase
        .from('pdf_import_profiles')
        .insert({
          name: profile.name,
          description: `Profilo di mappatura per ${profile.name}`,
          column_mappings: profile.columnMappings,
          owner_uid: (await supabase.auth.getUser()).data.user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Profilo salvato con successo",
      });

      await loadProfiles(); // Refresh list
      return data.id;
    } catch (error) {
      console.error('Error saving profile:', error);
      toast({
        title: "Errore",
        description: "Impossibile salvare il profilo",
        variant: "destructive",
      });
      return null;
    }
  };

  const updateProfile = async (id: string, profile: ParsingProfile): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('pdf_import_profiles')
        .update({
          name: profile.name,
          column_mappings: profile.columnMappings,
        })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Profilo aggiornato con successo",
      });

      await loadProfiles();
      return true;
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: "Errore",
        description: "Impossibile aggiornare il profilo",
        variant: "destructive",
      });
      return false;
    }
  };

  const deleteProfile = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('pdf_import_profiles')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Profilo eliminato con successo",
      });

      await loadProfiles();
      return true;
    } catch (error) {
      console.error('Error deleting profile:', error);
      toast({
        title: "Errore",
        description: "Impossibile eliminare il profilo",
        variant: "destructive",
      });
      return false;
    }
  };

  useEffect(() => {
    loadProfiles();
  }, []);

  return {
    profiles,
    isLoading,
    saveProfile,
    updateProfile,
    deleteProfile,
    refreshProfiles: loadProfiles,
  };
};