import { useState } from 'react';
import Tesseract from 'tesseract.js';
import type { PDFPage } from './PDFToImageConverter';

export interface OCRResult {
  pageNumber: number;
  text: string;
  confidence: number;
}

export const useOCRProcessor = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);

  const processPages = async (pages: PDFPage[]): Promise<OCRResult[]> => {
    setIsProcessing(true);
    setProgress(0);
    setCurrentPage(0);

    const results: OCRResult[] = [];

    try {
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        setCurrentPage(i + 1);

        const worker = await Tesseract.createWorker('ita', 1, {
          logger: m => {
            if (m.status === 'recognizing text') {
              const pageProgress = (i / pages.length) * 100;
              const ocrProgress = m.progress * 100;
              const totalProgress = pageProgress + (ocrProgress / pages.length);
              setProgress(totalProgress);
            }
          }
        });

        const { data } = await worker.recognize(page.imageData);
        
        results.push({
          pageNumber: page.pageNumber,
          text: data.text,
          confidence: data.confidence,
        });

        await worker.terminate();
      }

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
};