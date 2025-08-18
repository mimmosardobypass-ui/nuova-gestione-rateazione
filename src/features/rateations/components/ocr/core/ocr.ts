import Tesseract from 'tesseract.js';

const CDNS = {
  unpkg: {
    workerPath: 'https://unpkg.com/tesseract.js@5.0.4/dist/worker.min.js',
    corePath:   'https://unpkg.com/tesseract.js-core@5.0.0/tesseract-core.wasm.js',
    langPath:   'https://tessdata.projectnaptha.com/4.0.0_best',
  },
  jsdelivr: {
    workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.0.4/dist/worker.min.js',
    corePath:   'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.0.0/tesseract-core.wasm.js',
    langPath:   'https://tessdata.projectnaptha.com/4.0.0_best',
  },
  // opzionale: metti i file in /public/ocr/ se vuoi lavorare offline
  local: {
    workerPath: '/ocr/worker.min.js',
    corePath:   '/ocr/tesseract-core.wasm.js',
    langPath:   '/ocr',
  },
};

type Cfg = typeof CDNS.unpkg;

async function tryCreateWorker(cfg: Cfg) {
  return Tesseract.createWorker('ita+eng', 1, {
    logger: (m) => {
      // Log leggero, evita spam nella console
      if (m.status === 'recognizing text') return;
      // console.log('[OCR]', m);
    },
    workerPath: cfg.workerPath,
    corePath:   cfg.corePath,
    langPath:   cfg.langPath,
  });
}

/**
 * Esegue OCR su un'immagine (dataURL) con fallback multiplo dei worker.
 */
export async function ocrImageData(
  imageData: string,
  onProgress?: (p: number) => void
): Promise<{ text: string; confidence: number; words: any[] }> {
  let worker: Tesseract.Worker | null = null;

  for (const cfg of [CDNS.unpkg, CDNS.jsdelivr, CDNS.local]) {
    try {
      worker = await tryCreateWorker(cfg);
      break;
    } catch (e) {
      console.warn('[OCR] Worker load failed on', cfg.workerPath, e);
    }
  }

  if (!worker) {
    throw new Error('Impossibile caricare il worker OCR (verifica rete/CDN).');
  }

  try {
    // Configura parametri per tabelle
    await worker.setParameters({
      preserve_interword_spaces: '1',
      tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
    });

    const { data } = await worker.recognize(imageData);

    // Estrai words manualmente da Tesseract data
    const words: any[] = [];
    if (data && (data as any).words) {
      for (const word of (data as any).words) {
        if (word.text && word.text.trim()) {
          words.push({
            text: word.text.trim(),
            x0: word.bbox?.x0 ?? 0,
            y0: word.bbox?.y0 ?? 0,
            x1: word.bbox?.x1 ?? (word.bbox?.x0 ?? 0) + (word.bbox?.width ?? 0),
            y1: word.bbox?.y1 ?? (word.bbox?.y0 ?? 0) + (word.bbox?.height ?? 0),
            conf: word.confidence ?? 0,
            page: 1,
          });
        }
      }
    }

    if (onProgress) {
      onProgress(100);
    }

    return { 
      text: data.text || '', 
      confidence: data.confidence || 0,
      words 
    };
  } finally {
    await worker.terminate();
  }
}