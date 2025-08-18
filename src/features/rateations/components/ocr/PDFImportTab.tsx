import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, FileText, Eye, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { usePDFToImageConverter } from './core/usePDFToImageConverter';
import { useOCRProcessor } from './core/useOCRProcessor';
import { OCRTextParser, type ParsedInstallment } from './OCRTextParser';
import { ImportReviewTable } from './ImportReviewTable';

interface PDFImportTabProps {
  onInstallmentsParsed: (installments: ParsedInstallment[]) => void;
  onCancel: () => void;
}

export const PDFImportTab = ({ onInstallmentsParsed, onCancel }: PDFImportTabProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [step, setStep] = useState<'upload' | 'convert' | 'ocr' | 'review'>('upload');
  const [ocrResults, setOcrResults] = useState<string>('');
  const [parsedInstallments, setParsedInstallments] = useState<ParsedInstallment[]>([]);
  const { toast } = useToast();

  const { convertPDFToImages, isConverting, progress: convertProgress } = usePDFToImageConverter();
  const { processPages, isProcessing, progress: ocrProgress, currentPage } = useOCRProcessor(2);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
      toast({
        title: "PDF selezionato",
        description: `File: ${file.name}`,
      });
    } else {
      toast({
        title: "Errore",
        description: "Seleziona un file PDF valido",
        variant: "destructive",
      });
    }
  }, [toast]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
      toast({
        title: "PDF caricato",
        description: `File: ${file.name}`,
      });
    } else {
      toast({
        title: "Errore",
        description: "Trascina un file PDF valido",
        variant: "destructive",
      });
    }
  }, [toast]);

  const handleStartOCR = async () => {
    if (!selectedFile) {
      toast({
        title: "Errore",
        description: "Nessun file selezionato",
        variant: "destructive",
      });
      return;
    }

    console.log('Starting OCR process for file:', selectedFile.name);

    try {
      setStep('convert');
      toast({
        title: "Conversione PDF",
        description: "Convertendo le pagine PDF in immagini...",
      });
      
      const pages = await convertPDFToImages(selectedFile);
      console.log(`PDF converted to ${pages.length} page images`);
      
      setStep('ocr');
      toast({
        title: "Elaborazione OCR",
        description: "Estraendo il testo dalle immagini...",
      });
      const results = await processPages(pages);
      
      const combinedText = results.map(r => r.text).join('\n\n');
      console.log('Combined OCR text length:', combinedText.length);
      setOcrResults(combinedText);
      
      // Try advanced tabular parser first
      const allWords = results.flatMap(r => r.words);
      let parsed: ParsedInstallment[] = [];
      
      if (allWords.length > 0) {
        try {
          const { extractInstallmentsFromWords } = await import('./core/TableFromWords');
          parsed = extractInstallmentsFromWords(allWords);
          console.log('Tabular parser extracted:', parsed.length, 'installments');
        } catch (error) {
          console.warn('Tabular parser failed, falling back to regex:', error);
        }
      }
      
      // Fallback to regex parser if tabular failed
      if (parsed.length === 0) {
        const regexParsed = OCRTextParser.parseOCRText(combinedText);
        const { valid } = OCRTextParser.validateInstallments(regexParsed);
        parsed = valid;
        console.log('Regex parser extracted:', parsed.length, 'installments');
      }
      
      setParsedInstallments(parsed);
      setStep('review');
      
      toast({
        title: "OCR completato",
        description: `Estratte ${parsed.length} rate valide`,
      });
    } catch (error: any) {
      // log completo
      console.error('[OCR] Fatal error:', error);

      // messaggio umano
      let msg = 'Errore durante l\'elaborazione del PDF';
      if (error?.message) msg = error.message;
      else if (typeof error === 'string') msg = error;

      toast({
        title: 'Errore OCR',
        description: msg,
        variant: 'destructive',
      });

      setStep('upload');
    }
  };

  const handleInstallmentsConfirmed = (installments: ParsedInstallment[]) => {
    onInstallmentsParsed(installments);
  };

  if (step === 'upload') {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Carica Piano di Ammortamento PDF
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => document.getElementById('pdf-upload')?.click()}
            >
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium mb-2">
                Trascina il PDF qui o clicca per selezionare
              </p>
              <p className="text-sm text-muted-foreground">
                Supportato: PDF con piani di ammortamento tabellari
              </p>
              
              <input
                id="pdf-upload"
                type="file"
                accept=".pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {selectedFile && (
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <span className="font-medium">{selectedFile.name}</span>
                    <span className="text-sm text-muted-foreground">
                      ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                    </span>
                  </div>
                  <Button onClick={handleStartOCR}>
                    Avvia OCR
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'convert' || step === 'ocr') {
    const isOCRStep = step === 'ocr';
    const progress = isOCRStep ? ocrProgress : convertProgress;
    const title = isOCRStep ? 'Elaborazione OCR in corso...' : 'Conversione PDF in corso...';
    const description = isOCRStep 
      ? `Elaborando pagina ${currentPage}...` 
      : 'Convertendo pagine PDF in immagini...';

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              {title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <div className="text-2xl font-bold mb-2">{Math.round(progress)}%</div>
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-muted-foreground mt-2">
                {description}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'review') {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Revisione Dati Estratti
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ImportReviewTable
              installments={parsedInstallments}
              onConfirm={handleInstallmentsConfirmed}
              onCancel={onCancel}
            />
          </CardContent>
        </Card>

        {ocrResults && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Testo OCR Grezzo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-40 overflow-y-auto bg-muted p-4 rounded-lg">
                <pre className="text-sm whitespace-pre-wrap">{ocrResults}</pre>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return null;
};