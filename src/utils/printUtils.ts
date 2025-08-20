import { supabase } from "@/integrations/supabase/client";

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
    const w = window.open('about:blank', '_blank');
    if (w) {
      try {
        w.document.write(`
          <html><head><title>Preparazione…</title></head>
          <body style="font:14px system-ui;padding:24px">
            Preparazione documento di stampa…
          </body></html>`);
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
    setTimeout(() => win.location.replace(absolute), 80);
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
          filename: `riepilogo-rateazioni-${new Date().toISOString().slice(0,10)}.pdf`,
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
          filename: `rateazione-${rateationId}-${new Date().toISOString().slice(0,10)}.pdf`,
        },
      });
    } catch {}
    this.navigate(win, path);
  }

  /** Anteprima matrice annuale: apertura immediata (client-side) */
  static openAnnualMatrixPreview(opts: { metric?: 'paid'|'due'|'overdue'|'extra_ravv'; yoy?: boolean } & PrintOptions = {}) {
    const { metric, yoy, ...printOpts } = opts;
    const def = { theme: 'bn' as const, density: 'compact' as const }; // Matrix defaults (no from/to)
    const q = this.buildQuery({
      theme: printOpts.theme ?? def.theme,
      density: printOpts.density ?? def.density,
      logo: printOpts.logo ?? undefined,
      metric: metric || 'paid',
      yoy: yoy ? 1 : undefined,
    });
    const path = `/print/annual-matrix${q}`;

    // pre-open per aggirare popup blocker (allineato agli altri report)
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