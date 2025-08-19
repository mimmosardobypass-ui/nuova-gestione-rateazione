import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, FileText, Eye, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { usePDFTextExtractor } from './core/usePDFTextExtractor';
import { extractAdrRates } from '../../parsers/adrRates.extract';
import { extractPagopaRates } from '../../parsers/pagopaRates.extract';
import { detectPDFFormat, isFormatReliable } from '../../parsers/pdfDetector';
import { hasTextLayer, normalizePdfViaApi } from '@/utils/normalizePdfClient';
import { repairAderSchedule } from '@/utils/repairAderSchedule';
import type { Rata } from '../../parsers/adrRates.types';
import type { PDFFormat } from '../../parsers/pdfDetector';
import type { ParsedInstallment } from './types';
import { ImportReviewTable } from './ImportReviewTable';

interface PDFImportTabProps {
  onInstallmentsParsed: (installments: ParsedInstallment[]) => void;
  onCancel: () => void;
}

export const PDFImportTab = ({ onInstallmentsParsed, onCancel }: PDFImportTabProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [step, setStep] = useState<'upload' | 'text' | 'ocr' | 'review'>('upload');
  const [ocrResults, setOcrResults] = useState<string>('');
  const [parsedInstallments, setParsedInstallments] = useState<ParsedInstallment[]>([]);
  const [currentPhase, setCurrentPhase] = useState<'text' | 'ocr' | 'done'>('text');
  const [progress, setProgress] = useState(0);
  const [detectedFormat, setDetectedFormat] = useState<PDFFormat>('UNKNOWN');
  const { toast } = useToast();

  const { extractTextFromPDF, isExtracting, progress: extractProgress } = usePDFTextExtractor();

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

    let fileToProcess = selectedFile;
    setStep('text');
    setCurrentPhase('text');
    setProgress(0);

    try {
      // Step 1: Extract text from PDF for format detection
      console.log('[PDFImportTab] Starting PDF processing for file:', selectedFile.name);
      const textPages = await extractTextFromPDF(selectedFile, 3);
      
      if (textPages.length === 0) {
        toast({
          title: "Errore",
          description: "Impossibile estrarre testo dal PDF",
          variant: "destructive",
        });
        setStep('upload');
        return;
      }

      // Step 2: Auto-detect PDF format
      const detection = detectPDFFormat(textPages);
      setDetectedFormat(detection.format);
      
      console.log('[PDFImportTab] PDF Format Detection:', detection);
      
      if (!isFormatReliable(detection)) {
        toast({
          title: "Formato incerto",
          description: `Formato PDF non riconosciuto con sicurezza. Verrà usato il parser F24 come fallback.`,
        });
      } else {
        toast({
          title: "Formato rilevato",
          description: `${detection.format} (confidenza: ${Math.round(detection.confidence * 100)}%)`,
        });
      }

      // 🔧 Check if PDF normalization is needed
      const needsNormalization = detection.format === 'PAGOPA' || detection.format === 'UNKNOWN';
      const hasText = await hasTextLayer(selectedFile, 2);
      
      if (needsNormalization && !hasText) {
        console.log(`[PDFImportTab] PDF lacks text layer, normalizing with OCRmyPDF...`);
        setCurrentPhase('ocr');
        setStep('ocr');
        toast({
          title: "Normalizzazione PDF",
          description: "Text-layer assente: applico OCR per creare PDF ricercabile...",
        });
        
        try {
          fileToProcess = await normalizePdfViaApi(selectedFile);
          console.log(`[PDFImportTab] PDF normalized successfully`);
        } catch (error) {
          console.warn(`[PDFImportTab] PDF normalization failed, proceeding with original:`, error);
          // Continue with original file if normalization fails
        }
        
        setCurrentPhase('text');
        setStep('text');
      }

      let rateTable: Rata[] = [];

      // 🧠 Smart parsing: try both parsers if format is uncertain
      if (detection.format === 'PAGOPA') {
        console.log(`[PDFImportTab] Using PagoPA parser (confidence: ${detection.confidence})`);
        toast({
          title: "Parser PagoPA",
          description: "Utilizzando parser ibrido per Agenzia delle Entrate",
        });
        
        rateTable = await extractPagopaRates(fileToProcess, {
          minExpected: 10,
          onPhase: (phase) => {
            setCurrentPhase(phase);
            setStep(phase === "ocr" ? "ocr" : "text");
          },
          onProgress: (p) => setProgress(p),
        });
      } else if (detection.format === 'F24') {
        console.log(`[PDFImportTab] Using F24 parser (confidence: ${detection.confidence})`);
        toast({
          title: "Parser F24",
          description: "Utilizzando parser ibrido per F24/Commercialista",
        });
        
        rateTable = await extractAdrRates(fileToProcess, {
          minExpected: 8,
          onPhase: (phase) => {
            setCurrentPhase(phase);
            setStep(phase === "ocr" ? "ocr" : "text");
          },
          onProgress: (p) => setProgress(p),
        });
      } else {
        // UNKNOWN format - try both parsers as fallback
        console.log(`[PDFImportTab] Unknown format, trying PagoPA parser first...`);
        toast({
          title: "Formato incerto",
          description: "Provo parser PagoPA come primo tentativo...",
        });
        
        try {
          rateTable = await extractPagopaRates(fileToProcess, {
            minExpected: 5, // Lower threshold for unknown format
            onPhase: (phase) => {
              setCurrentPhase(phase);
              setStep(phase === "ocr" ? "ocr" : "text");
            },
            onProgress: (p) => setProgress(p),
          });
          
          console.log(`[PDFImportTab] PagoPA parser found ${rateTable.length} rates`);
          
          // If PagoPA parser fails, try F24 parser
          if (rateTable.length < 3) {
            console.log(`[PDFImportTab] PagoPA parser insufficient, trying F24 parser...`);
            toast({
              title: "Fallback F24",
              description: "Provo parser F24 come alternativa...",
            });
            
            rateTable = await extractAdrRates(fileToProcess, {
              minExpected: 3,
              onPhase: (phase) => {
                setCurrentPhase(phase);
                setStep(phase === "ocr" ? "ocr" : "text");
              },
              onProgress: (p) => setProgress(p),
            });
            
            console.log(`[PDFImportTab] F24 parser found ${rateTable.length} rates`);
          }
        } catch (error) {
          console.warn(`[PDFImportTab] PagoPA parser failed, trying F24:`, error);
          
          rateTable = await extractAdrRates(fileToProcess, {
            minExpected: 3,
            onPhase: (phase) => {
              setCurrentPhase(phase);
              setStep(phase === "ocr" ? "ocr" : "text");
            },
            onProgress: (p) => setProgress(p),
          });
        }
      }

      console.log(`[PDFImportTab] Parser found ${rateTable.length} rates:`, rateTable);

      // 🛟 Safety net: repair 9/10 schedule
      let finalRates = rateTable.map(r => ({ scadenza: r.scadenza, amount: r.totaleEuro }));
      if (finalRates.length === 9) {
        console.log(`[PDFImportTab] Found 9 rates, attempting repair...`);
        finalRates = repairAderSchedule(finalRates);
        if (finalRates.length === 10) {
          toast({
            title: "Rata ricostruita",
            description: "Completata la 10ª scadenza mancante con pattern trimestrale.",
          });
        }
      }

      // Convert to UI format
      const parsed: ParsedInstallment[] = finalRates.map((rate, index) => ({
        seq: index + 1,
        due_date: rate.scadenza,
        amount: rate.amount,
        description: detection.format === 'PAGOPA' 
          ? `N. Modulo ${index + 1} - ${rate.scadenza}`
          : `Rata ${index + 1} - ${rate.scadenza}`,
        anno: rate.scadenza.slice(-4),
        notes: `Parser ibrido (${detection.format})${needsNormalization && !hasText ? " + OCRmyPDF" : ""}${finalRates.length === 10 && rateTable.length === 9 ? " + riparazione" : ""}`,
      }));

      setParsedInstallments(parsed);
      setOcrResults(`Estratte ${parsed.length} rate utilizzando parser ${detection.format} (${currentPhase === 'text' ? 'text-layer' : 'OCR'})${finalRates.length === 10 && rateTable.length === 9 ? ' + rata ricostruita' : ''}`);
      setStep('review');

      // Show success/warning based on results
      const expectedMin = detection.format === 'PAGOPA' ? 5 : 8;
      if (parsed.length >= expectedMin) {
        toast({
          title: "Parsing completato",
          description: `Estratte ${parsed.length} rate con successo (formato: ${detection.format})`,
        });
      } else {
        toast({
          title: "Attenzione",
          description: `Estratte solo ${parsed.length} rate (attese almeno ${expectedMin}). Verifica i dati prima di confermare.`,
          variant: "destructive",
        });
        console.table(parsed);
      }

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

  if (step === 'text' || step === 'ocr') {
    let title = '';
    let description = '';
    
    if (step === 'text') {
      title = 'Analisi text-layer in corso...';
      description = 'Estraendo testo geometricamente dal PDF...';
    } else {
      title = 'Elaborazione OCR in corso...';
      description = 'Processando con riconoscimento ottico...';
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
                {description} (Formato: {detectedFormat})
              </p>
              {step === 'text' && currentPhase === 'text' && (
                <p className="text-xs text-primary mt-1">
                  ⚡ Analisi geometrica text-layer
                </p>
              )}
              {step === 'ocr' && currentPhase === 'ocr' && (
                <p className="text-xs text-orange-600 mt-1">
                  🔄 {progress === 0 ? 'Normalizzazione OCRmyPDF' : 'OCR geometrico word-level'}
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
                Testo Estratto ({currentPhase === 'text' ? 'Text-layer' : 'OCR'})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-40 overflow-y-auto bg-muted p-4 rounded-lg">
                <pre className="text-sm whitespace-pre-wrap">{ocrResults}</pre>
              </div>
              {currentPhase === 'text' && (
                <p className="text-xs text-green-600 mt-2">
                  ✅ Estratto direttamente dal text-layer PDF (veloce e preciso)
                </p>
              )}
              {currentPhase === 'ocr' && (
                <p className="text-xs text-orange-600 mt-2">
                  🔄 Estratto tramite OCR con geometria word-level
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