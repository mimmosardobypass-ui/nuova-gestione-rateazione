import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, safeSupabaseOperation } from '@/integrations/supabase/client-resilient';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  authReady: boolean;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  authReady: false,
  signUp: async () => ({ error: null }),
  signIn: async () => ({ error: null }),
  signOut: async () => {},
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    let initialized = false;

    // Funzione per gestire il bootstrap della sessione
    const initializeAuth = async () => {
      try {
        if (!supabase) {
          console.warn('Supabase client not available during auth initialization');
          if (!mounted) return;
          initialized = true;
          setAuthReady(true);
          setLoading(false);
          return;
        }
        
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;
        
        setSession(session);
        setUser(session?.user ?? null);
        initialized = true;
        setAuthReady(true);
        setLoading(false);
      } catch (error) {
        console.error('Error initializing auth:', error);
        if (!mounted) return;
        initialized = true;
        setAuthReady(true);
        setLoading(false);
      }
    };

    // Set up auth state listener
    let subscription: any = null;
    if (supabase) {
      const { data: { subscription: sub } } = supabase.auth.onAuthStateChange(
        (event, session) => {
          if (!mounted) return;
          setSession(session);
          setUser(session?.user ?? null);
          
          // Only set loading to false if we've completed initialization
          // This prevents premature false negatives during app startup
          if (initialized) {
            setAuthReady(true);
            setLoading(false);
          }
        }
      );
      subscription = sub;
    }

    // Initialize auth
    initializeAuth();

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string) => {
    if (!supabase) {
      return { error: { message: 'Supabase non disponibile' } };
    }
    
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl
      }
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    if (!supabase) {
      return { error: { message: 'Supabase non disponibile' } };
    }
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signOut = async () => {
    if (!supabase) {
      console.warn('Cannot sign out: Supabase not available');
      return;
    }
    
    await supabase.auth.signOut();
    // Il redirect verrà gestito automaticamente da onAuthStateChange
  };

  const value = {
    user,
    session,
    loading,
    authReady,
    signUp,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};