import { useState } from 'react';
import Tesseract from 'tesseract.js';
import type { PDFPage } from './PDFToImageConverter';

export interface OCRResult {
  pageNumber: number;
  text: string;
  confidence: number;
}

// Enhanced OCR function using Tesseract.js v6 API with CDN fallback
async function ocrImageData(imageData: string, onProgress?: (progress: number) => void): Promise<{ text: string; confidence: number }> {
  const worker = await Tesseract.createWorker('ita', 1, {
    logger: m => {
      if (m.status === 'recognizing text' && onProgress) {
        onProgress(Math.round(m.progress * 100));
      }
    },
    errorHandler: err => console.error('Tesseract worker error:', err)
  });

  try {
    const { data } = await worker.recognize(imageData);
    return {
      text: data.text,
      confidence: data.confidence
    };
  } finally {
    await worker.terminate();
  }
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
    // Limit pages for initial testing
    const maxPages = Math.min(pages.length, 2);

    try {
      console.log(`[OCR] Starting processing for ${maxPages} pages (${pages.length} total)...`);
      
      for (let i = 0; i < maxPages; i++) {
        const page = pages[i];
        setCurrentPage(i + 1);
        console.log(`[OCR] Processing page ${i + 1}/${maxPages}...`);

        try {
          const data = await ocrImageData(page.imageData, (pageProgress) => {
            const totalPageProgress = (i / maxPages) * 100;
            const currentProgress = totalPageProgress + (pageProgress / maxPages);
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
          // Continue with next page instead of failing completely
          results.push({
            pageNumber: page.pageNumber,
            text: '',
            confidence: 0,
          });
        }
      }

      console.log(`[OCR] Processing completed. ${results.length} pages processed.`);
      return results;
    } catch (error) {
      console.error('[OCR] Fatal processing error:', error);
      throw error;
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