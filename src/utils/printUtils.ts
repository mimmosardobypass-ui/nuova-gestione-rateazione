import { supabase } from "@/integrations/supabase/client";

export interface PrintOptions {
  theme?: "bn" | "color";
  density?: "compact" | "normal";
  logo?: string;
  from?: string;
  to?: string;
  type?: string;
  state?: "open" | "late" | "paid";
}

export class PrintService {
  private static getDefaultOptions(): PrintOptions {
    const currentYear = new Date().getFullYear();
    return {
      theme: 'bn',          // bianco/nero
      density: 'compact',   // tabella compatta  
      from: `${currentYear}-01-01`,
      to: `${currentYear}-12-31`,
    };
  }

  private static buildQueryString(options: PrintOptions): string {
    const params = new URLSearchParams();
    
    Object.entries(options).forEach(([key, value]) => {
      if (value) {
        params.set(key, String(value));
      }
    });
    
    return params.toString() ? `?${params.toString()}` : "";
  }

  /**
   * Open print preview in new tab for summary report
   */
  static openRiepilogoPreview(options: PrintOptions = {}) {
    const mergedOptions = { ...this.getDefaultOptions(), ...options };
    const queryString = this.buildQueryString(mergedOptions);
    const url = `/print/riepilogo${queryString}`;
    window.open(url, "_blank");
  }

  /**
   * Open print preview in new tab for rateation detail
   */
  static openSchedaPreview(rateationId: string, options: PrintOptions = {}) {
    const mergedOptions = { ...this.getDefaultOptions(), ...options };
    const queryString = this.buildQueryString(mergedOptions);
    const url = `/print/rateazione/${rateationId}${queryString}`;
    window.open(url, "_blank");
  }

  /**
   * Generate PDF using the edge function
   */
  static async generatePDF(url: string, filename: string): Promise<void> {
    try {
      const fullUrl = `${window.location.origin}${url}`;
      
      const { data, error } = await supabase.functions.invoke('generate-pdf', {
        body: { url: fullUrl, filename }
      });

      if (error) throw error;

      // For now, since we're using client-side PDF generation,
      // we'll open the print URL and let the browser handle it
      if (data.printUrl) {
        const printWindow = window.open(data.printUrl, "_blank");
        if (printWindow) {
          printWindow.focus();
          // Add a small delay to ensure the page loads before printing
          setTimeout(() => {
            printWindow.print();
          }, 1000);
        }
      }
    } catch (error) {
      console.error("Error generating PDF:", error);
      throw new Error("Errore nella generazione del PDF");
    }
  }

  /**
   * Generate PDF for summary report
   */
  static async generateRiepilogoPDF(options: PrintOptions = {}): Promise<void> {
    const mergedOptions = { ...this.getDefaultOptions(), ...options };
    const queryString = this.buildQueryString(mergedOptions);
    const url = `/print/riepilogo${queryString}`;
    const filename = `riepilogo-rateazioni-${new Date().toISOString().split('T')[0]}.pdf`;
    
    return this.generatePDF(url, filename);
  }

  /**
   * Generate PDF for rateation detail
   */
  static async generateSchedaPDF(rateationId: string, options: PrintOptions = {}): Promise<void> {
    const mergedOptions = { ...this.getDefaultOptions(), ...options };
    const queryString = this.buildQueryString(mergedOptions);
    const url = `/print/rateazione/${rateationId}${queryString}`;
    const filename = `rateazione-${rateationId}-${new Date().toISOString().split('T')[0]}.pdf`;
    
    return this.generatePDF(url, filename);
  }

  /**
   * Print current page using browser's native print functionality
   */
  static printCurrentPage() {
    window.print();
  }
}