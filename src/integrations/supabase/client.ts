import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// IMPORTANT: Lovable non usa .env. Inserisci qui URL e ANON KEY pubblica.
// TODO: sostituisci con i valori reali del tuo progetto Supabase
const SUPABASE_URL = "https://YOUR-PROJECT.supabase.co";
const SUPABASE_ANON_KEY = "YOUR-ANON-PUBLIC-KEY";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
