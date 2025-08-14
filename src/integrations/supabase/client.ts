
// src/integrations/supabase/client.ts
import { createClient } from "@supabase/supabase-js";

/**
 * URL del tuo progetto Supabase
 * (dalla UI: Project Settings → API → Project URL)
 */
export const SUPABASE_URL = "https://ebcjwtjebzvabedboybv.supabase.co";

/**
 * Chiave pubblica anon (anon key) — eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImViY2p3dGplYnp2YWJlZGJveWJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2OTUyMTMsImV4cCI6MjA3MDI3MTIxM30.46bn0XIN8CwMPkVwj0vBxmGoCPQF3fVby8NSj92Rl4Y
 * (dalla UI: Project Settings → API → Project API keys → anon public → Copy)
 */
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImViY2p3dGplYnp2YWJlZGJveWJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2OTUyMTMsImV4cCI6MjA3MDI3MTIxM30.46bn0XIN8CwMPkVwj0vBxmGoCPQF3fVby8NSj92Rl4Y";

/**
 * Client Supabase con persistenza sessione
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
  },
  global: {
    fetch: fetch,
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
});
