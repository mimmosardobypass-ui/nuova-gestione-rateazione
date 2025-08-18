// Robust PDF.js singleton initialization
import { GlobalWorkerOptions, version as pdfjsVersion } from 'pdfjs-dist';

let configured = false;

export async function ensurePdfjsReady() {
  if (configured) return;

  // Import dinamici per evitare problemi SSR e bundle
  const pdfjs: any = await import('pdfjs-dist');
  
  // Usa CDN per il worker - più affidabile di path locali complessi
  GlobalWorkerOptions.workerSrc = 
    `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.js`;

  // Meno log per ridurre noise
  if (pdfjs.VerbosityLevel) {
    pdfjs.VerbosityLevel = pdfjs.VerbosityLevel.ERRORS || 0;
  }

  configured = true;
  console.log('[PDF.js] Worker configured:', GlobalWorkerOptions.workerSrc);
}

export async function getPdfjs() {
  await ensurePdfjsReady();
  return (await import('pdfjs-dist'));
}