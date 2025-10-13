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

    // Calcola quanto è larga la pagina rispetto alla finestra
    const contentWidth = el.scrollWidth;
    const viewportWidth = window.innerWidth;

    // Calcola la scala necessaria
    let scale = viewportWidth / contentWidth;
    scale = Math.max(minScale, Math.min(maxScale, scale));

    // Applica solo se scala < 1 (contenuto deborda)
    if (scale < 1) {
      el.style.transform = `scale(${scale})`;
      el.style.transformOrigin = "top left";
      el.style.width = `${(100 / scale).toFixed(3)}%`;
    } else {
      // Reset se il contenuto sta già tutto dentro
      el.style.transform = "";
      el.style.transformOrigin = "";
      el.style.width = "";
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
