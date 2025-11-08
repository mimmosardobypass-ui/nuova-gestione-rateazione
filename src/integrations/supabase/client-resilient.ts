import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseEnv, isSupabaseConfigured } from './health';

const { url, anon } = getSupabaseEnv();

// Export null when not configured to avoid crashes
export const supabase: SupabaseClient | null = 
  isSupabaseConfigured() ? createClient(url, anon, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: window.localStorage,
    },
    global: {
      fetch: (url: RequestInfo | URL, options?: RequestInit) => fetch(url, options),
    },
    realtime: {
      params: { eventsPerSecond: 10 },
    },
  }) : null;

// Helper for code that requires Supabase
export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error('Supabase non configurato (segreti non disponibili)');
  }
  return supabase;
}

// Safe wrapper for Supabase operations
export async function safeSupabaseOperation<T>(
  operation: (client: SupabaseClient) => Promise<T>,
  fallback?: T
): Promise<T | null> {
  try {
    if (!supabase) {
      console.warn('Supabase client not available, returning fallback');
      return fallback ?? null;
    }
    return await operation(supabase);
  } catch (error) {
    console.error('Supabase operation failed:', error);
    return fallback ?? null;
  }
}

// Legacy export removed to prevent circular imports