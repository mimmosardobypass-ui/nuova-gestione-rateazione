import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, filename = "report.pdf" } = await req.json();
    
    if (!url) {
      return new Response(
        JSON.stringify({ error: "Missing url parameter" }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`Generating PDF for URL: ${url}`);

    // Use Puppeteer via Browserless service (since we can't install Playwright in Supabase Edge Functions)
    // For now, we'll create a simple HTML-to-PDF conversion using the browsers print functionality
    // In production, you might want to use a service like Browserless or implement server-side rendering
    
    // For this implementation, we'll return the URL for the browser to handle printing
    // The actual PDF generation will be handled client-side using window.print()
    
    return new Response(
      JSON.stringify({ 
        message: "PDF generation initiated", 
        printUrl: url,
        filename 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in generate-pdf function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});