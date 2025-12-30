import { supabase } from "@/integrations/supabase/client-resilient";
import { toLocalISO } from "@/utils/date";

export type PrintOptions = {
  theme?: 'bn' | 'color';
  density?: 'compact' | 'normal';
  from?: string;
  to?: string;
  logo?: string;
};

export class PrintService {
  // Default comodi: B/N, denso, anno corrente
  static getDefaultOptions(): PrintOptions {
    const y = new Date().getFullYear();
    return {
      theme: 'bn',
      density: 'compact',
      from: `${y}-01-01`,
      to: `${y}-12-31`,
    };
  }

  private static buildQuery(params: Record<string, string | number | boolean | undefined>) {
    const p = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
    });
    const s = p.toString();
    return s ? `?${s}` : '';
  }

  private static buildQueryString(opt: PrintOptions) {
    const p = new URLSearchParams();
    if (opt.theme) p.set('theme', opt.theme);
    if (opt.density) p.set('density', opt.density);
    if (opt.from) p.set('from', opt.from);
    if (opt.to) p.set('to', opt.to);
    if (opt.logo) p.set('logo', opt.logo);
    const s = p.toString();
    return s ? `?${s}` : '';
  }

  /** Pre-apre una finestra (sincrona al click) per evitare i popup blocker */
  private static preOpenWindow(): Window | null {
    const w = window.open("about:blank", "_blank");
    if (w) {
      try {
        w.document.write(`
          <html><head><title>Preparazione…</title></head>
          <body style="font-family:system-ui;padding:16px;">Preparazione documento di stampa…</body>
          </html>
        `);
        w.document.close();
      } catch {}
    }
    return w;
  }

  /** Naviga la finestra preaperta verso un path/URL assoluto in modo sicuro */
  private static navigate(win: Window, pathOrUrl: string) {
    const absolute = /^https?:\/\//i.test(pathOrUrl)
      ? pathOrUrl
      : `${window.location.origin}${pathOrUrl}`;
    
    // Aggiunge cache buster per evitare problemi di versioni React miste
    const separator = absolute.includes('?') ? '&' : '?';
    const urlWithCacheBuster = `${absolute}${separator}_t=${Date.now()}`;
    
    setTimeout(() => win.location.replace(urlWithCacheBuster), 80);
  }

  /** Anteprima riepilogo: apertura immediata (client-side) */
  static openRiepilogoPreview(options: PrintOptions = {}) {
    const q = this.buildQueryString({ ...this.getDefaultOptions(), ...options });
    const url = `/print/riepilogo${q}`;
    const win = this.preOpenWindow();
    if (!win) {
      window.location.assign(url); // fallback se il popup è bloccato
      return;
    }
    this.navigate(win, url);
  }

  /** Anteprima scheda rateazione: apertura immediata (client-side) */
  static openSchedaPreview(rateationId: string, options: PrintOptions = {}) {
    const q = this.buildQueryString({ ...this.getDefaultOptions(), ...options });
    const url = `/print/rateazione/${rateationId}${q}`;
    const win = this.preOpenWindow();
    if (!win) {
      window.location.assign(url);
      return;
    }
    this.navigate(win, url);
  }

  /**
   * Generazione PDF (edge function opzionale).
   * Manteniamo la chiamata, ma l'apertura è SEMPRE via finestra preaperta.
   */
  static async generateRiepilogoPDF(options: PrintOptions = {}) {
    const q = this.buildQueryString({ ...this.getDefaultOptions(), ...options });
    const path = `/print/riepilogo${q}`;
    const win = this.preOpenWindow();
    if (!win) {
      window.location.assign(path);
      return;
    }
    try {
      await supabase.functions.invoke('generate-pdf', {
        body: {
          url: `${window.location.origin}${path}`,
          filename: `riepilogo-rateazioni-${toLocalISO(new Date())}.pdf`,
        },
      });
    } catch {
      // Silenzioso: non blocchiamo l'apertura
    }
    this.navigate(win, path);
  }

  static async generateSchedaPDF(rateationId: string, options: PrintOptions = {}) {
    const q = this.buildQueryString({ ...this.getDefaultOptions(), ...options });
    const path = `/print/rateazione/${rateationId}${q}`;
    const win = this.preOpenWindow();
    if (!win) {
      window.location.assign(path);
      return;
    }
    try {
      await supabase.functions.invoke('generate-pdf', {
        body: {
          url: `${window.location.origin}${path}`,
          filename: `rateazione-${rateationId}-${toLocalISO(new Date())}.pdf`,
        },
      });
    } catch {}
    this.navigate(win, path);
  }

  /** Anteprima matrice annuale (client-side, con anti-popup) */
  static openAnnualMatrixPreview(
    opts: { metric: "paid" | "due" | "overdue" | "extra_ravv"; yoy?: boolean } & PrintOptions = { metric: "paid" }
  ) {
    const { metric, yoy, ...printOpts } = opts;
    const def = { theme: "bn" as const, density: "compact" as const }; // per la matrice non servono from/to
    const q = this.buildQuery({
      theme: printOpts.theme ?? def.theme,
      density: printOpts.density ?? def.density,
      logo: printOpts.logo ?? undefined,
      metric: metric || "paid",
      yoy: yoy ? 1 : undefined,
    });
    const path = `/print/annual-matrix${q}`;

    const w = this.preOpenWindow();
    if (!w) {
      window.location.assign(path);
      return;
    }
    setTimeout(() => w.location.replace(`${window.location.origin}${path}`), 60);
  }

  /** Transfer auth session to print window via postMessage */
  private static async transferSessionToWindow(win: Window, path: string) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token && session?.refresh_token) {
        // Wait for window to load then send session
        const sendSession = () => {
          try {
            win.postMessage({
              type: 'SUPABASE_SESSION_TRANSFER',
              access_token: session.access_token,
              refresh_token: session.refresh_token
            }, window.location.origin);
          } catch {}
        };
        // Send multiple times to ensure delivery
        setTimeout(sendSession, 300);
        setTimeout(sendSession, 800);
        setTimeout(sendSession, 1500);
      }
    } catch {}
  }

  /** Anteprima report unificato rateazioni a rischio (F24 + PagoPA) */
  static openUnifiedAtRiskPreview(options: PrintOptions = {}) {
    const def = this.getDefaultOptions();
    const q = this.buildQueryString({ 
      theme: options.theme ?? def.theme,
      density: options.density ?? def.density,
      logo: options.logo ?? def.logo
    });
    const path = `/print/rateazioni-a-rischio${q}`;
    
    const w = this.preOpenWindow();
    if (!w) {
      window.location.assign(path);
      return;
    }
    this.navigate(w, path);
    this.transferSessionToWindow(w, path);
  }

  /** Anteprima report F24 a rischio */
  static openF24AtRiskPreview(options: PrintOptions = {}) {
    const def = this.getDefaultOptions();
    const q = this.buildQueryString({ 
      theme: options.theme ?? def.theme,
      density: options.density ?? def.density,
      logo: options.logo ?? def.logo
    });
    const path = `/print/f24-a-rischio${q}`;
    
    const w = this.preOpenWindow();
    if (!w) {
      window.location.assign(path);
      return;
    }
    this.navigate(w, path);
    this.transferSessionToWindow(w, path);
  }

  /** Anteprima report PagoPA a rischio */
  static openPagopaAtRiskPreview(options: PrintOptions = {}) {
    const def = this.getDefaultOptions();
    const q = this.buildQueryString({ 
      theme: options.theme ?? def.theme,
      density: options.density ?? def.density,
      logo: options.logo ?? def.logo
    });
    const path = `/print/pagopa-a-rischio${q}`;
    
    const w = this.preOpenWindow();
    if (!w) {
      window.location.assign(path);
      return;
    }
    this.navigate(w, path);
    this.transferSessionToWindow(w, path);
  }

  /** Anteprima report Quater a rischio (Rottamazione Quater e Riam.Quater) */
  static openQuaterAtRiskPreview(options: PrintOptions = {}) {
    const def = this.getDefaultOptions();
    const q = this.buildQueryString({ 
      theme: options.theme ?? def.theme,
      density: options.density ?? def.density,
      logo: options.logo ?? def.logo
    });
    const path = `/print/quater-a-rischio${q}`;
    
    const w = this.preOpenWindow();
    if (!w) {
      window.location.assign(path);
      return;
    }
    this.navigate(w, path);
    this.transferSessionToWindow(w, path);
  }

  /** Anteprima report scadenze (client-side, con anti-popup) */
  static openScadenzePreview(
    filters: {
      startDate?: string;
      endDate?: string;
      typeIds?: number[];
      bucket?: string;
      search?: string;
      payFilter?: 'paid' | 'unpaid' | 'all';
    },
    options: PrintOptions = {}
  ) {
    const q = this.buildQuery({
      theme: options.theme ?? 'bn',
      density: options.density ?? 'compact',
      logo: options.logo ?? undefined,
      startDate: filters.startDate,
      endDate: filters.endDate,
      typeIds: filters.typeIds?.join(','),
      bucket: filters.bucket,
      search: filters.search,
      payFilter: filters.payFilter,
    });
    const path = `/print/scadenze${q}`;

    const w = this.preOpenWindow();
    if (!w) {
      window.location.assign(path);
      return;
    }
    setTimeout(() => w.location.replace(`${window.location.origin}${path}`), 60);
  }

  /**
   * Print current page using browser's native print functionality
   */
  static printCurrentPage() {
    window.print();
  }
}