import { useState } from 'react';
import { getPdfjs } from '@/lib/pdfjs';
import type { PDFPage } from './types';

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
      // Garantisce workerSrc impostato PRIMA di getDocument
      const pdfjs = await getPdfjs();
      
      const pdf = await pdfjs.getDocument({ 
        data: arrayBuffer,
        isEvalSupported: false,
        useSystemFonts: true,
      }).promise;
      
      const numPages = pdf.numPages;
      console.log(`PDF loaded with ${numPages} pages`);
      const pages: PDFPage[] = [];

      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        console.log(`Processing page ${pageNum}/${numPages}...`);
        
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for better OCR
        
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