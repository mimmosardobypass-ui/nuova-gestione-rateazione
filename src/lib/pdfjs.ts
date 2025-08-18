// Robust PDF.js singleton initialization
let configured = false;

// Fixed CDN URL matching our dependency version
const PDFJS_CDN_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.6.82/pdf.worker.min.js';

export async function ensurePdfjsReady() {
  if (configured) return;

  // Import dinamico per evitare problemi SSR e bundle
  const pdfjs: any = await import('pdfjs-dist');
  
  // 1) Worker: va impostato PRIMA di qualsiasi getDocument()
  pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_CDN_WORKER;

  // 2) Verbosity: usa setVerbosity se disponibile, evita assegnazione diretta
  if (typeof pdfjs.setVerbosity === 'function' && pdfjs.VerbosityLevel) {
    pdfjs.setVerbosity(pdfjs.VerbosityLevel.ERRORS);
  }

  configured = true;
  console.log('[PDF.js] Worker configured:', PDFJS_CDN_WORKER);
}

export async function getPdfjs() {
  await ensurePdfjsReady();
  // Re-import per avere le API (getDocument, ecc.)
  return (await import('pdfjs-dist')) as any;
}