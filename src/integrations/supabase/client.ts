import { createClient } from "@supabase/supabase-js";

// URL del progetto Supabase
const SUPABASE_URL = "https://ebcjwtjebzvabedboybv.supabase.co";

// Chiave pubblica anon (anon key)
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImViY2p3dGplYnphdmVkYm95YnYiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTcyMzEwNDA4NiwiZXhwIjoxNzU0NjYwMDg2fQ.tzLWDBTnvv1AvwoZRBUTs__CwmXVGX4poCJq_a8B57U";

// Creazione del client Supabase
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
