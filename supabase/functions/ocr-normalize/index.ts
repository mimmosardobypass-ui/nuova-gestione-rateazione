import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { 
      status: 405, 
      headers: corsHeaders 
    });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return new Response('File missing', { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    console.log(`OCR Normalize: Processing file ${file.name}, size: ${file.size} bytes`);

    // Generate unique filenames
    const id = crypto.randomUUID();
    const inPath = `/tmp/input_${id}.pdf`;
    const outPath = `/tmp/output_${id}.pdf`;

    // Write input file
    const fileBytes = new Uint8Array(await file.arrayBuffer());
    await Deno.writeFile(inPath, fileBytes);

    console.log(`OCR Normalize: Starting OCRmyPDF process for ${inPath}`);

    // Run OCRmyPDF via Docker
    const process = new Deno.Command("docker", {
      args: [
        "run", "--rm",
        "-v", "/tmp:/data",
        "ghcr.io/ocrmypdf/ocrmypdf:latest",
        "--force-ocr",
        "-l", "ita+eng",
        "--rotate-pages",
        "--deskew", 
        "--clean-final",
        "--output-type", "pdfa",
        "--optimize", "1",
        "--jobs", "2",
        `input_${id}.pdf`,
        `output_${id}.pdf`
      ],
      cwd: "/tmp",
      stdout: "piped",
      stderr: "piped"
    });

    const { code, stdout, stderr } = await process.output();

    if (code !== 0) {
      const errorText = new TextDecoder().decode(stderr);
      console.error(`OCRmyPDF failed with code ${code}:`, errorText);
      
      // Cleanup
      try { await Deno.remove(inPath); } catch {}
      try { await Deno.remove(outPath); } catch {}
      
      return new Response(`OCR normalization failed: ${errorText}`, { 
        status: 500, 
        headers: corsHeaders 
      });
    }

    console.log(`OCR Normalize: Process completed successfully`);

    // Read output file
    const outputBytes = await Deno.readFile(outPath);

    // Cleanup
    try { await Deno.remove(inPath); } catch {}
    try { await Deno.remove(outPath); } catch {}

    console.log(`OCR Normalize: Returning normalized PDF, size: ${outputBytes.length} bytes`);

    return new Response(outputBytes, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="normalized.pdf"'
      }
    });

  } catch (error) {
    console.error('OCR Normalize error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(`Internal server error: ${errorMessage}`, { 
      status: 500, 
      headers: corsHeaders 
    });
  }
})