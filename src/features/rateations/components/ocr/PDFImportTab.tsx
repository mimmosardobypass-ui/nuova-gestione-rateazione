import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, FileText, Eye, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { usePDFToImageConverter } from './core/usePDFToImageConverter';
import { useOCRProcessor } from './core/useOCRProcessor';
import { usePDFTextExtractor } from './core/usePDFTextExtractor';
import { OCRTextParser, type ParsedInstallment } from './OCRTextParser';
import { extractInstallmentsFromTextLayer, validateAgenziaInstallments } from './core/TextLayerParser';
import { extractAdrRateTable } from '../../parsers/adrRateTable';
import { ImportReviewTable } from './ImportReviewTable';

interface PDFImportTabProps {
  onInstallmentsParsed: (installments: ParsedInstallment[]) => void;
  onCancel: () => void;
}

export const PDFImportTab = ({ onInstallmentsParsed, onCancel }: PDFImportTabProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [step, setStep] = useState<'upload' | 'extract' | 'convert' | 'ocr' | 'review'>('upload');
  const [ocrResults, setOcrResults] = useState<string>('');
  const [parsedInstallments, setParsedInstallments] = useState<ParsedInstallment[]>([]);
  const [parsingMethod, setParsingMethod] = useState<'text-layer' | 'ocr'>('text-layer');
  const { toast } = useToast();

  const { extractTextFromPDF, isExtracting, progress: extractProgress } = usePDFTextExtractor();
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

  const handleStartProcessing = async () => {
    if (!selectedFile) {
      toast({
        title: "Errore",
        description: "Nessun file selezionato",
        variant: "destructive",
      });
      return;
    }

    console.log('Starting PDF processing for file:', selectedFile.name);

    try {
      // STEP 1: Try robust geometric text-layer extraction for Agenzia delle Entrate-Riscossione
      setStep('extract');
      setParsingMethod('text-layer');
      toast({
        title: "Estrazione testo PDF",
        description: "Tentando estrazione geometrica robusta...",
      });
      
      console.log('Starting robust geometric text-layer extraction...');
      const rateTable = await extractAdrRateTable(selectedFile);
      
      let parsed: ParsedInstallment[] = [];
      let textPages: any[] = [];
      
      if (rateTable.length > 0) {
        console.log(`Robust text-layer parsing successful: found ${rateTable.length} installments`);
        
        // Map to ParsedInstallment format
        parsed = rateTable.map((rata, index) => ({
          seq: rata.seq || index + 1,
          due_date: rata.scadenza.replace(/(\d{2})-(\d{2})-(\d{4})/, '$3-$2-$1'), // Convert to ISO format
          amount: rata.totaleEuro,
          description: `N. Modulo ${rata.seq || index + 1} - ${rata.scadenza}`,
        }));
      } else {
        console.log('Robust text-layer extraction failed, trying standard text-layer...');
        
        // Fallback to standard text-layer extraction
        textPages = await extractTextFromPDF(selectedFile, 5);
        console.log(`Standard text extraction: ${textPages.length} pages`);
        
        const combinedText = textPages.map(p => p.text).join('\n\n');
        
        if (combinedText.length > 100) {
          parsed = extractInstallmentsFromTextLayer(textPages);
          console.log('Standard text-layer parser extracted:', parsed.length, 'installments');
          
          if (parsed.length > 0) {
            const { valid, warnings } = validateAgenziaInstallments(parsed);
            if (warnings.length > 0) {
              console.warn('Text-layer validation warnings:', warnings);
            }
            parsed = valid;
          }
        }
      }
      
      // STEP 2: Fallback to OCR if text-layer failed
      if (parsed.length === 0) {
        console.log('Text-layer extraction failed, falling back to OCR...');
        setParsingMethod('ocr');
        
        setStep('convert');
        toast({
          title: "Conversione PDF",
          description: "Text-layer insufficiente, convertendo in immagini...",
        });
        
        const pages = await convertPDFToImages(selectedFile);
        console.log(`PDF converted to ${pages.length} page images`);
        
        setStep('ocr');
        toast({
          title: "Elaborazione OCR",
          description: "Estraendo il testo dalle immagini...",
        });
        const results = await processPages(pages);
        
        const ocrText = results.map(r => r.text).join('\n\n');
        console.log('Combined OCR text length:', ocrText.length);
        setOcrResults(ocrText);
        
        // Try advanced tabular parser first
        const allWords = results.flatMap(r => r.words);
        
        if (allWords.length > 0) {
          try {
            const { extractInstallmentsFromWords } = await import('./core/TableFromWords');
            parsed = extractInstallmentsFromWords(allWords);
            console.log('OCR tabular parser extracted:', parsed.length, 'installments');
          } catch (error) {
            console.warn('OCR tabular parser failed, falling back to regex:', error);
          }
        }
        
        // Final fallback to regex parser
        if (parsed.length === 0) {
          const regexParsed = OCRTextParser.parseOCRText(ocrText);
          const { valid } = OCRTextParser.validateInstallments(regexParsed);
          parsed = valid;
          console.log('OCR regex parser extracted:', parsed.length, 'installments');
        }
      } else {
        // Text-layer successful, set display text
        if (rateTable.length > 0) {
          setOcrResults(`Parsed ${rateTable.length} installments using robust geometric text-layer extraction`);
        } else {
          const combinedText = textPages.map(p => p.text).join('\n\n');
          setOcrResults(combinedText);
        }
      }
      
      setParsedInstallments(parsed);
      setStep('review');
      
      const method = parsingMethod === 'text-layer' ? 'text-layer' : 'OCR';
      toast({
        title: `Parsing ${method} completato`,
        description: `Estratte ${parsed.length} rate valide`,
      });
    } catch (error: any) {
      console.error('[PDF Processing] Fatal error:', error);

      let msg = 'Errore durante l\'elaborazione del PDF';
      if (error?.message) msg = error.message;
      else if (typeof error === 'string') msg = error;

      toast({
        title: 'Errore Processing',
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
                  <Button onClick={handleStartProcessing}>
                    Avvia Parsing
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'extract' || step === 'convert' || step === 'ocr') {
    let progress = 0;
    let title = '';
    let description = '';
    
    if (step === 'extract') {
      progress = extractProgress;
      title = 'Estrazione text-layer in corso...';
      description = 'Estraendo testo dal PDF...';
    } else if (step === 'convert') {
      progress = convertProgress;
      title = 'Conversione PDF in corso...';
      description = 'Convertendo pagine PDF in immagini...';
    } else {
      progress = ocrProgress;
      title = 'Elaborazione OCR in corso...';
      description = `Elaborando pagina ${currentPage}...`;
    }

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
              {parsingMethod === 'text-layer' && step === 'extract' && (
                <p className="text-xs text-primary mt-1">
                  ⚡ Metodo veloce: estrazione diretta dal PDF
                </p>
              )}
              {parsingMethod === 'ocr' && (
                <p className="text-xs text-orange-600 mt-1">
                  🔄 Fallback OCR: text-layer non disponibile
                </p>
              )}
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
                Testo Estratto {parsingMethod === 'text-layer' ? '(Text-layer)' : '(OCR)'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-40 overflow-y-auto bg-muted p-4 rounded-lg">
                <pre className="text-sm whitespace-pre-wrap">{ocrResults}</pre>
              </div>
              {parsingMethod === 'text-layer' && (
                <p className="text-xs text-green-600 mt-2">
                  ✅ Estratto direttamente dal text-layer PDF (veloce e preciso)
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return null;
};