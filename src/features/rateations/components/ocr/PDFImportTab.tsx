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
import { extractAdrRates } from '../../parsers/adrRates.extract';
import type { Rata } from '../../parsers/adrRates.types';
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
      console.log('Starting hybrid PDF processing for file:', selectedFile.name);
      
      const rateTable: Rata[] = await extractAdrRates(selectedFile, {
        minExpected: 10,
        onPhase: (phase) => {
          setCurrentPhase(phase);
          if (phase === 'text') {
            setStep('text');
            toast({
              title: "Analisi text-layer",
              description: "Tentando estrazione geometrica robusta...",
            });
          } else if (phase === 'ocr') {
            setStep('ocr');
            toast({
              title: "Elaborazione OCR",
              description: "Text-layer insufficiente, processando con OCR...",
            });
          }
        },
        onProgress: (p) => setProgress(p),
      });
      
      console.log(`Hybrid parsing successful: found ${rateTable.length} installments`);
      
      // Map to ParsedInstallment format
      const parsed: ParsedInstallment[] = rateTable.map((rata, index) => ({
        seq: rata.seq || index + 1,
        due_date: rata.scadenza.replace(/(\d{2})-(\d{2})-(\d{4})/, '$3-$2-$1'), // Convert to ISO format
        amount: rata.totaleEuro,
        description: `N. Modulo ${rata.seq || index + 1} - ${rata.scadenza}`,
      }));
      
      setParsedInstallments(parsed);
      setOcrResults(`Estratte ${rateTable.length} rate utilizzando il parser ibrido (${currentPhase === 'text' ? 'text-layer' : 'OCR'})`);
      setStep('review');
      
      const method = currentPhase === 'text' ? 'text-layer' : 'OCR';
      toast({
        title: `Parsing ${method} completato`,
        description: `Estratte ${parsed.length} rate valide`,
      });
      
      if (rateTable.length < 10) {
        toast({
          title: "Attenzione",
          description: `Rilevate solo ${rateTable.length} rate. Verifica la tabella o aggiungi manualmente le righe mancanti.`,
          variant: "destructive",
        });
        console.table(rateTable);
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
    let displayProgress = 0;
    let title = '';
    let description = '';
    
    if (step === 'text') {
      displayProgress = 50; // Static for text-layer
      title = 'Analisi text-layer in corso...';
      description = 'Estraendo testo geometricamente dal PDF...';
    } else {
      displayProgress = progress;
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
              <div className="text-2xl font-bold mb-2">{Math.round(displayProgress)}%</div>
              <Progress value={displayProgress} className="w-full" />
              <p className="text-sm text-muted-foreground mt-2">
                {description}
              </p>
              {step === 'text' && (
                <p className="text-xs text-primary mt-1">
                  ⚡ Metodo veloce: estrazione diretta dal PDF
                </p>
              )}
              {step === 'ocr' && (
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