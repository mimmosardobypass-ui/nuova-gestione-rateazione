import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Printer, FileText, Download, Settings } from "lucide-react";
import { PrintService, PrintOptions } from "@/utils/printUtils";
import { useToast } from "@/hooks/use-toast";

interface PrintButtonsProps {
  rateationId?: string;
  showSummaryOptions?: boolean;
  showDetailOptions?: boolean;
  defaultOptions?: PrintOptions;
}

export function PrintButtons({ 
  rateationId, 
  showSummaryOptions = true, 
  showDetailOptions = false,
  defaultOptions = {}
}: PrintButtonsProps) {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const handlePreviewSummary = () => {
    PrintService.openRiepilogoPreview(defaultOptions);
  };

  const handlePreviewDetail = () => {
    if (!rateationId) return;
    PrintService.openSchedaPreview(rateationId, defaultOptions);
  };

  const handlePDFSummary = async () => {
    setIsGenerating(true);
    try {
      await PrintService.generateRiepilogoPDF(defaultOptions);
      toast({
        title: "PDF generato",
        description: "Il report riepilogo è stato preparato per la stampa",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Errore",
        description: "Impossibile generare il PDF",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePDFDetail = async () => {
    if (!rateationId) return;
    setIsGenerating(true);
    try {
      await PrintService.generateSchedaPDF(rateationId, defaultOptions);
      toast({
        title: "PDF generato",
        description: "La scheda rateazione è stata preparata per la stampa",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Errore",
        description: "Impossibile generare il PDF",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  if (showDetailOptions && rateationId) {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePreviewDetail}
          className="flex items-center gap-2"
        >
          <FileText className="h-4 w-4" />
          Anteprima
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handlePDFDetail}
          disabled={isGenerating}
          className="flex items-center gap-2"
        >
          <Download className="h-4 w-4" />
          {isGenerating ? "Generazione..." : "PDF"}
        </Button>
      </div>
    );
  }

  if (showSummaryOptions) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="flex items-center gap-2">
            <Printer className="h-4 w-4" />
            Stampa Report
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handlePreviewSummary}>
            <FileText className="h-4 w-4 mr-2" />
            Anteprima Riepilogo
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handlePDFSummary} disabled={isGenerating}>
            <Download className="h-4 w-4 mr-2" />
            {isGenerating ? "Generazione..." : "PDF Riepilogo"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return null;
}