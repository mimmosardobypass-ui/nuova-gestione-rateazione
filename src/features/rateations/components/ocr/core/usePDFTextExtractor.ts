import { useState, useCallback } from 'react';
import { getPdfDocument } from '@/lib/pdfjs';
import type { PDFPage } from './types';

export interface TextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  transform: number[];
  fontName?: string;
  hasEOL?: boolean;
}

export interface ExtractedPageText {
  pageNumber: number;
  items: TextItem[];
  text: string;
}

export const usePDFTextExtractor = () => {
  const [isExtracting, setIsExtracting] = useState(false);
  const [progress, setProgress] = useState(0);

  const extractTextFromPDF = useCallback(async (
    file: File,
    maxPages: number = 10
  ): Promise<ExtractedPageText[]> => {
    setIsExtracting(true);
    setProgress(0);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await getPdfDocument({ data: arrayBuffer });
      const numPages = Math.min(pdf.numPages, maxPages);
      const results: ExtractedPageText[] = [];

      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        const items: TextItem[] = textContent.items.map((item: any) => ({
          str: item.str,
          x: item.transform[4],
          y: item.transform[5],
          width: item.width,
          height: item.height,
          transform: item.transform,
          fontName: item.fontName,
          hasEOL: item.hasEOL,
        }));

        const text = textContent.items.map((item: any) => item.str).join(' ');

        results.push({
          pageNumber: pageNum,
          items,
          text,
        });

        setProgress((pageNum / numPages) * 100);
      }

      return results;
    } finally {
      setIsExtracting(false);
      setProgress(0);
    }
  }, []);

  return {
    extractTextFromPDF,
    isExtracting,
    progress,
  };
};