export type PDFPage = {
  pageNumber: number;
  imageData: string; // data URL (image/png)
  width: number;
  height: number;
};

export type OCRResult = {
  pageNumber: number;
  text: string;
  confidence: number;
};