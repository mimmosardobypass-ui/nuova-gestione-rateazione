// Loader unico e idempotente per PDF.js + worker, senza CDN.
// Funziona con Vite/Lovable perché usa ?url: il worker viene bundle-izzato sullo stesso dominio.

let configured = false;
let cachedPdfjs: any = null;
let fallbackDisableWorker = false;

export async function loadPdfjs() {
  if (typeof window === 'undefined') {
    throw new Error('PDF.js può essere caricato solo lato client');
  }
  if (configured && cachedPdfjs) return cachedPdfjs;

  // Import del build principale (API stabili)
  const pdfjs: any = await import('pdfjs-dist');
  // Import del file worker come URL locale
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;

  try {
    // Modalità più affidabile: creiamo noi il Worker e lo passiamo come "porta"
    const worker = new Worker(workerUrl, { type: 'module' as any });
    pdfjs.GlobalWorkerOptions.workerPort = worker;
    // Optional: meno rumore di log, evita di toccare proprietà readonly
    if (typeof pdfjs.setVerbosity === 'function' && pdfjs.VerbosityLevel) {
      pdfjs.setVerbosity(pdfjs.VerbosityLevel.ERRORS);
    }
  } catch {
    // Fallback classico: src stringa
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  }

  configured = true;
  cachedPdfjs = pdfjs;
  return pdfjs;
}

/**
 * Wrapper robusto: tenta il worker; se fallisce forza disableWorker=true (sempre funziona).
 */
export async function getPdfDocument(params: any) {
  const pdfjs = await loadPdfjs();

  try {
    return await pdfjs.getDocument({
      ...params,
      isEvalSupported: false,
      useSystemFonts: true,
      disableWorker: false,
    }).promise;
  } catch (err) {
    console.warn('[PDF] worker fallito, retry senza worker:', err);
    fallbackDisableWorker = true;
    return await pdfjs.getDocument({
      ...params,
      isEvalSupported: false,
      useSystemFonts: true,
      disableWorker: true,
    }).promise;
  }
}

export function isWorkerDisabledFallback() {
  return fallbackDisableWorker;
}

// Legacy compatibility exports
export async function ensurePdfjsReady() {
  await loadPdfjs();
}

export async function getPdfjs() {
  return await loadPdfjs();
}