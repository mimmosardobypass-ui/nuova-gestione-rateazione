import { getDocument } from "pdfjs-dist";
import { loadPdfjs } from "@/lib/pdfjs";

/** Ritorna true se almeno una pagina ha text-layer non vuoto */
export async function hasTextLayer(file: File, checkPages = 2): Promise<boolean> {
  await loadPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await getDocument({ data }).promise;
  
  try {
    const pages = Math.min(checkPages, pdf.numPages);
    console.log(`[hasTextLayer] Checking ${pages} pages for text content`);
    
    for (let p = 1; p <= pages; p++) {
      const page = await pdf.getPage(p);
      const content: any = await page.getTextContent();
      
      if (content?.items?.length > 0) {
        const textContent = content.items.map((item: any) => item.str || '').join(' ').trim();
        if (textContent.length > 10) { // At least some meaningful text
          console.log(`[hasTextLayer] Found text content on page ${p}: ${textContent.substring(0, 100)}...`);
          return true;
        }
      }
    }
    
    console.log(`[hasTextLayer] No meaningful text content found in ${pages} pages`);
    return false;
  } finally {
    try { await pdf.cleanup(); } catch {}
    try { await pdf.destroy(); } catch {}
  }
}

/** Chiama l'endpoint backend e restituisce un nuovo File normalizzato */
export async function normalizePdfViaApi(file: File): Promise<File> {
  console.log(`[normalizePdfViaApi] Starting normalization for ${file.name}`);
  
  const formData = new FormData();
  formData.append("file", file, file.name);
  
  const response = await fetch("/api/ocr-normalize", {
    method: "POST",
    body: formData
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[normalizePdfViaApi] API call failed:`, errorText);
    throw new Error(`OCR normalization failed: ${errorText}`);
  }
  
  const blob = await response.blob();
  const normalizedFileName = file.name.replace(/\.pdf$/i, "_searchable.pdf");
  
  console.log(`[normalizePdfViaApi] Normalization completed. Output size: ${blob.size} bytes`);
  
  return new File([blob], normalizedFileName, { type: "application/pdf" });
}