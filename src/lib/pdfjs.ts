// Robust PDF.js singleton initialization
let configured = false;

export async function ensurePdfjsReady() {
  if (configured) return;

  // Import dinamici per evitare problemi SSR e bundle
  const pdfjs: any = await import('pdfjs-dist');
  
  try {
    // Con Vite: usare ?url per ottenere l'URL del worker nel bundle
    const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  } catch (error) {
    // Fallback per configurazioni diverse
    const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.js?url')).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  }

  // Meno log per ridurre noise
  if (pdfjs.VerbosityLevel) {
    pdfjs.VerbosityLevel = pdfjs.VerbosityLevel.ERRORS || 0;
  }

  configured = true;
  console.log('[PDF.js] Worker configured:', pdfjs.GlobalWorkerOptions.workerSrc);
}

export async function getPdfjs() {
  await ensurePdfjsReady();
  return (await import('pdfjs-dist'));
}