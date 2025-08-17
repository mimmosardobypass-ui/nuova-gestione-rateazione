import { useState } from 'react';
import * as pdfjs from 'pdfjs-dist';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

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
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      const numPages = pdf.numPages;
      const pages: PDFPage[] = [];

      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 2.0 });
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        if (!context) {
          throw new Error('Cannot get canvas context');
        }

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
          canvas: canvas,
        };

        await page.render(renderContext).promise;
        
        const imageData = canvas.toDataURL('image/png');
        
        pages.push({
          pageNumber: pageNum,
          imageData,
          width: viewport.width,
          height: viewport.height,
        });

        setProgress((pageNum / numPages) * 100);
      }

      return pages;
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