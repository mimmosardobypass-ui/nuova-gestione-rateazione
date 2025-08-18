import { useState } from 'react';
import { ocrImageData } from './ocr';
import type { PDFPage, OCRResult } from './types';

export function useOCRProcessor(defaultMaxPages = 10) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);

  /**
   * Esegue l'OCR su un array di pagine convertite (immagini PNG).
   * @param pages Pagine da processare
   * @param maxPages opzionale: limita il numero di pagine per test iniziale
   */
  const processPages = async (
    pages: PDFPage[],
    maxPages: number = defaultMaxPages
  ): Promise<OCRResult[]> => {
    setIsProcessing(true);
    setProgress(0);
    setCurrentPage(0);

    const results: OCRResult[] = [];
    const toProcess = Math.min(pages.length, Math.max(1, maxPages));

    try {
      console.log(`[OCR] Starting processing for ${toProcess} pages (${pages.length} total)...`);

      for (let i = 0; i < toProcess; i++) {
        const page = pages[i];
        setCurrentPage(i + 1);
        console.log(`[OCR] Processing page ${i + 1}/${toProcess}...`);

        try {
          const data = await ocrImageData(page.imageData, (pageProgress) => {
            const totalPageProgress = (i / toProcess) * 100;
            const currentProgress = totalPageProgress + (pageProgress / toProcess);
            setProgress(currentProgress);
          });

          console.log(`[OCR] Completed for page ${i + 1}, confidence: ${data.confidence}%`);

          results.push({
            pageNumber: page.pageNumber,
            text: data.text,
            confidence: data.confidence,
          });
        } catch (pageError) {
          console.error(`[OCR] Error processing page ${i + 1}:`, pageError);
          // Continuiamo con la pagina successiva
          results.push({
            pageNumber: page.pageNumber,
            text: '',
            confidence: 0,
          });
        }
      }

      console.log(`[OCR] Processing completed. ${results.length} pages processed.`);
      return results;
    } finally {
      setIsProcessing(false);
      setProgress(0);
      setCurrentPage(0);
    }
  };

  return {
    processPages,
    isProcessing,
    progress,
    currentPage,
  };
}