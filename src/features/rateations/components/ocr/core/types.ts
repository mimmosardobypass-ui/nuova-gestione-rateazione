export type PDFPage = {
  pageNumber: number;
  imageData: string; // data URL (image/png)
  width: number;
  height: number;
};

export type OCRWord = {
  text: string;
  x0: number; 
  y0: number; 
  x1: number; 
  y1: number;
  conf: number;
  page: number;
};

export type OCRResult = {
  pageNumber: number;
  text: string;
  confidence: number;
  words: OCRWord[];
};