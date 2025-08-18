import { useState } from 'react';
import * as pdfjs from 'pdfjs-dist';
import { GlobalWorkerOptions } from 'pdfjs-dist';
import type { PDFPage } from './types';

// worker ufficiale pdf.js
GlobalWorkerOptions.workerSrc =
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.8.69/build/pdf.worker.min.js';

export function usePDFToImageConverter() {
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState(0);

  const convertPDFToImages = async (file: File): Promise<PDFPage[]> => {
    setIsConverting(true);
    setProgress(0);

    try {
      console.log('Converting file to array buffer...');
      const arrayBuffer = await file.arrayBuffer();
      
      console.log('Loading PDF document...');
      const pdf = await pdfjs.getDocument({ 
        data: arrayBuffer,
        verbosity: 0,
        disableAutoFetch: false,
        disableStream: false,
        isEvalSupported: false,
        useSystemFonts: true
      }).promise;
      
      const numPages = pdf.numPages;
      console.log(`PDF loaded with ${numPages} pages`);
      const pages: PDFPage[] = [];

      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        console.log(`Processing page ${pageNum}/${numPages}...`);
        
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.5 }); // Moderate scale to avoid memory issues
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        if (!ctx) throw new Error('Cannot get canvas context');

        await page.render({ canvasContext: ctx, viewport, canvas }).promise;
        
        pages.push({
          pageNumber: pageNum,
          imageData: canvas.toDataURL('image/png'),
          width: viewport.width,
          height: viewport.height,
        });

        setProgress((pageNum / numPages) * 100);
      }

      console.log(`Successfully converted ${pages.length} pages`);
      return pages;
    } catch (error) {
      console.error('PDF conversion error:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Errore sconosciuto nella conversione PDF';
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch')) {
          errorMessage = 'Errore nel caricamento del worker PDF. Controlla la connessione internet.';
        } else if (error.message.includes('InvalidPDFException')) {
          errorMessage = 'Il file PDF non è valido o è corrotto.';
        } else if (error.message.includes('PasswordException')) {
          errorMessage = 'Il PDF è protetto da password.';
        } else {
          errorMessage = `Errore nella conversione PDF: ${error.message}`;
        }
      }
      
      throw new Error(errorMessage);
    } finally {
      setIsConverting(false);
      setProgress(0);
    }
  };

  return { convertPDFToImages, isConverting, progress };
}