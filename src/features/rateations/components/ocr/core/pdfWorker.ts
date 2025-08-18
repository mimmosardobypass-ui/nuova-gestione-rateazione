// Un modulo dedicato SOLO a configurare il worker di pdf.js in modo robusto
import { GlobalWorkerOptions, version as pdfjsVersion } from 'pdfjs-dist';

let configured = false;

export function ensurePdfWorker() {
  if (configured) return;

  // Metodo A) Import locale (Vite) – il più affidabile
  try {
    // In Vite il suffisso ?url fa emettere il file e restituisce l'URL finale
    // Se usi TypeScript potresti aver bisogno di "declare module '*.mjs?url';" in un d.ts
    // @ts-ignore
    import('pdfjs-dist/build/pdf.worker.min.mjs?url').then((mod) => {
      GlobalWorkerOptions.workerSrc = mod.default; // URL assoluto generato dal bundler
      configured = true;
      // console.debug('[pdf.js] workerSrc (vite url):', GlobalWorkerOptions.workerSrc);
    }).catch(() => {
      // Metodo B) /public – copia il worker dentro /public come "/pdf.worker.min.js"
      try {
        GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
        configured = true;
        // console.debug('[pdf.js] workerSrc (/public):', GlobalWorkerOptions.workerSrc);
      } catch {
        // Metodo C) CDN – fallback finale
        GlobalWorkerOptions.workerSrc =
          `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.js`;
        configured = true;
        // console.debug('[pdf.js] workerSrc (cdn):', GlobalWorkerOptions.workerSrc);
      }
    });
  } catch {
    // Se l'import dinamico fallisce subito, passa direttamente a /public
    try {
      GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
      configured = true;
    } catch {
      GlobalWorkerOptions.workerSrc =
        `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.js`;
      configured = true;
    }
  }
}