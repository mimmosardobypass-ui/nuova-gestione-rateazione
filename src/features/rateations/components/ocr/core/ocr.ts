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
): Promise<{ text: string; confidence: number }> {
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
    const { data } = await worker.recognize(imageData);
    return { text: data.text, confidence: data.confidence };
  } finally {
    await worker.terminate();
  }
}