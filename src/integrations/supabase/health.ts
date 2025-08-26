// Health check utilities for Supabase configuration
export function getSupabaseEnv() {
  // Priority to Vite env variables, fallback to runtime injected variables if needed
  const url = import.meta.env.VITE_SUPABASE_URL || (window as any).__SUPABASE_URL__;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY || (window as any).__SUPABASE_ANON__;
  
  // Fallback to hardcoded values if env variables are not available
  const fallbackUrl = "https://ebcjwtjebzvabedboybv.supabase.co";
  const fallbackAnon = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImViY2p3dGplYnp2YWJlZGJveWJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2OTUyMTMsImV4cCI6MjA3MDI3MTIxM30.46bn0XIN8CwMPkVwj0vBxmGoCPQF3fVby8NSj92Rl4Y";
  
  return { 
    url: url || fallbackUrl, 
    anon: anon || fallbackAnon 
  };
}

export function isSupabaseConfigured(): boolean {
  const { url, anon } = getSupabaseEnv();
  return Boolean(url && anon && url.includes('supabase.co') && anon.length > 20);
}

export function getSupabaseStatus(): 'healthy' | 'degraded' | 'down' {
  if (!isSupabaseConfigured()) return 'down';
  
  // Could add additional health checks here in the future
  // For now, just check if configured
  return 'healthy';
}