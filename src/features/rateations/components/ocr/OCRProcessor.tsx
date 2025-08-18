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
      console.log(`Starting OCR processing for ${pages.length} pages...`);
      
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        setCurrentPage(i + 1);
        console.log(`Processing page ${i + 1}/${pages.length}...`);

        try {
          const worker = await Tesseract.createWorker('ita', 1, {
            logger: m => {
              if (m.status === 'recognizing text') {
                const pageProgress = (i / pages.length) * 100;
                const ocrProgress = m.progress * 100;
                const totalProgress = pageProgress + (ocrProgress / pages.length);
                setProgress(totalProgress);
              }
            },
            errorHandler: err => console.error(`OCR worker error on page ${i + 1}:`, err)
          });

          const { data } = await worker.recognize(page.imageData);
          console.log(`OCR completed for page ${i + 1}, confidence: ${data.confidence}%`);
          
          results.push({
            pageNumber: page.pageNumber,
            text: data.text,
            confidence: data.confidence,
          });

          await worker.terminate();
        } catch (pageError) {
          console.error(`Error processing page ${i + 1}:`, pageError);
          // Continue with next page instead of failing completely
          results.push({
            pageNumber: page.pageNumber,
            text: '',
            confidence: 0,
          });
        }
      }

      console.log(`OCR processing completed. ${results.length} pages processed.`);
      return results;
    } catch (error) {
      console.error('OCR processing error:', error);
      throw new Error(`Errore durante l'elaborazione OCR: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`);
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