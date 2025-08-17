import { useState } from 'react';

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
      console.log('Loading PDF.js dynamically...');
      
      // Dynamic import to avoid SSR issues
      const pdfjs = await import('pdfjs-dist');
      
      // Use a more reliable worker setup
      if (typeof window !== 'undefined' && !pdfjs.GlobalWorkerOptions.workerSrc) {
        try {
          // Try to use the bundled worker first
          pdfjs.GlobalWorkerOptions.workerSrc = `/node_modules/pdfjs-dist/build/pdf.worker.min.js`;
        } catch {
          // Fallback to CDN if bundled version fails
          pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;
        }
      }

      console.log('Converting file to array buffer...');
      const arrayBuffer = await file.arrayBuffer();
      
      console.log('Loading PDF document...');
      const pdf = await pdfjs.getDocument({ 
        data: arrayBuffer,
        verbosity: 0,
        disableAutoFetch: true,
        disableStream: true
      }).promise;
      
      const numPages = pdf.numPages;
      console.log(`PDF loaded with ${numPages} pages`);
      const pages: PDFPage[] = [];

      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        console.log(`Processing page ${pageNum}/${numPages}...`);
        
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.5 }); // Reduced scale for better performance
        
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
      throw new Error(`Errore nella conversione PDF: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`);
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