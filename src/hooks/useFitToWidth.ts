import { useEffect, useRef, useCallback } from "react";

export interface FitToWidthOptions {
  minScale?: number;    // Default: 0.85 (preserva leggibilità)
  maxScale?: number;    // Default: 1.0
  breakpoint?: number;  // Default: 768px (sotto questa larghezza, fit disabilitato)
}

/**
 * Hook per adattare automaticamente la scala di un contenitore alla larghezza del browser.
 * Mantiene layout grafico intatto: ridimensiona solo in proporzione.
 * 
 * @param options Configurazione del fit (minScale, maxScale, breakpoint)
 * @returns ref da applicare al contenitore principale
 * 
 * @example
 * const containerRef = useFitToWidth<HTMLDivElement>({ minScale: 0.85 });
 * return <div ref={containerRef}>...</div>;
 */
export function useFitToWidth<T extends HTMLElement>(
  options: FitToWidthOptions = {}
) {
  const {
    minScale = 0.85,    // Più conservativo per leggibilità (non 0.75)
    maxScale = 1.0,
    breakpoint = 768,   // Sotto 768px, disabilita fit (mobile nativo)
  } = options;

  const ref = useRef<T | null>(null);
  const rafIdRef = useRef<number>(0);

  const fit = useCallback(() => {
    const el = ref.current;
    if (!el) return;

    // Disabilita fit su schermi sotto il breakpoint (mobile usa layout responsive nativo)
    if (window.innerWidth < breakpoint) {
      el.style.transform = "";
      el.style.transformOrigin = "";
      el.style.width = "";
      return;
    }

    // --- MISURA A STATO NATURALE (fix critico) ---
    const prevTransform = el.style.transform;
    const prevWidth = el.style.width;
    const prevOrigin = el.style.transformOrigin;

    // Reset completo per misura accurata
    el.style.transform = "";
    el.style.width = "";
    el.style.transformOrigin = "top left";

    // Forza reflow (fix bug browser)
    void el.offsetHeight;

    const naturalWidth = el.scrollWidth;       // Ora è accurato!
    const viewportWidth = window.innerWidth;

    let scale = viewportWidth / naturalWidth;
    scale = Math.max(minScale, Math.min(maxScale, scale));

    // --- APPLICA SOLO SE SERVE + MARGINE ANTI-SUBPIXEL ---
    if (scale < 1) {
      el.style.transform = `scale(${scale})`;
      el.style.transformOrigin = "top left";
      
      // +1px elimina il "pixel fantasma" che causa scrollbar
      const widened = (100 / scale);
      el.style.width = `calc(${widened.toFixed(3)}% + 1px)`;
    } else {
      // Reset completo
      el.style.transform = "";
      el.style.width = "";
      el.style.transformOrigin = prevOrigin || "";
    }
  }, [minScale, maxScale, breakpoint]);

  useEffect(() => {
    // Esegui fit immediato
    fit();

    // Debounce via requestAnimationFrame per resize
    const handleResize = () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
      rafIdRef.current = requestAnimationFrame(fit);
    };

    window.addEventListener("resize", handleResize);
    
    // Riesegui fit dopo caricamento immagini/lazy content
    const observer = new ResizeObserver(() => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
      rafIdRef.current = requestAnimationFrame(fit);
    });
    
    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      observer.disconnect();
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [fit]);

  return ref;
}
