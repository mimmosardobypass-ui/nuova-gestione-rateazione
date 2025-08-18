import { createWorker } from "tesseract.js";

export async function createWorkerCompat(lang = "ita+eng", logger?: (m: any) => void) {
  // Handle both Tesseract.js v4 and v6 API differences
  try {
    // Try v6 syntax first: createWorker(lang, oem, options)
    if ((createWorker as any).length >= 2) {
      return await (createWorker as any)(lang, 1, { logger });
    }
  } catch (error) {
    console.warn('Tesseract v6 syntax failed, trying v4:', error);
  }
  
  // Fallback to v4 syntax: createWorker(options) + manual setup
  try {
    const worker = await (createWorker as any)({ logger });
    await worker.loadLanguage(lang);
    await worker.initialize(lang);
    return worker;
  } catch (error) {
    console.error('Both Tesseract v4 and v6 syntax failed:', error);
    throw error;
  }
}