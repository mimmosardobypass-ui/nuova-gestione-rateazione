import { useState } from 'react';
import * as pdfjs from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker';

export interface PDFPage {
  pageNumber: number;
  imageData: string;
  width: number;
  height: number;
}

export const usePDFToImageConverter = () => {
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState(0);

  const convertPDFToImages = async (file: File): Promise<PDFPage[]> => {
    setIsConverting(true);
    setProgress(0);

    try {
      console.log('Configuring PDF.js worker for Vite...');
      
      // Configure worker properly for Vite environment
      if (typeof window !== 'undefined') {
        if (!pdfjs.GlobalWorkerOptions.workerSrc) {
          // Use CDN worker for Vite/Lovable compatibility
          pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;
          console.log('PDF.js worker configured with Vite worker');
        }
      }

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
        const viewport = page.getViewport({ scale: 1.5 }); // Optimal scale for OCR accuracy vs performance
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        if (!context) {
          throw new Error('Cannot get canvas context');
        }
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
          canvas: canvas,
        };

        await page.render(renderContext).promise;
        
        const imageData = canvas.toDataURL('image/jpeg', 0.8); // Use JPEG for smaller size
        
        pages.push({
          pageNumber: pageNum,
          imageData,
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

  return {
    convertPDFToImages,
    isConverting,
    progress,
  };
};