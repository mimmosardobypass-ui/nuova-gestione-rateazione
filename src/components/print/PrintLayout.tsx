import React, { useEffect, useRef } from "react";
import "@/styles/print.css";
import { supabase } from "@/integrations/supabase/client-resilient";

interface PrintLayoutProps {
  title: string;
  subtitle?: string;
  logoUrl?: string;
  bodyClass?: string;
  children: React.ReactNode;
}

export default function PrintLayout({
  title,
  subtitle,
  logoUrl,
  bodyClass = "",
  children,
}: PrintLayoutProps) {
  const sessionReceivedRef = useRef(false);

  // Listen for session transfer from parent window
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      // Validate origin
      if (event.origin !== window.location.origin) return;
      
      if (event.data?.type === 'SUPABASE_SESSION_TRANSFER') {
        const { access_token, refresh_token, transferId } = event.data;
        
        // Only set session once to avoid conflicts
        if (sessionReceivedRef.current) {
          // Still send ACK even if already received, so parent stops sending
          if (event.source && 'postMessage' in event.source) {
            try {
              (event.source as Window).postMessage(
                { type: 'SUPABASE_SESSION_TRANSFER_ACK', transferId },
                event.origin
              );
            } catch {}
          }
          return;
        }
        
        if (access_token && refresh_token) {
          try {
            await supabase.auth.setSession({ access_token, refresh_token });
            sessionReceivedRef.current = true;
            console.log('[PrintLayout] Session set successfully');
            
            // Send ACK back with transferId
            if (event.source && 'postMessage' in event.source) {
              (event.source as Window).postMessage(
                { type: 'SUPABASE_SESSION_TRANSFER_ACK', transferId },
                event.origin
              );
            }
          } catch (err) {
            console.warn('[PrintLayout] Failed to set session:', err);
          }
        }
      }
    };

    window.addEventListener('message', handleMessage);
    
    // Send PRINT_READY to parent so it can immediately send session
    if (window.opener && !window.opener.closed) {
      try {
        window.opener.postMessage(
          { type: 'PRINT_READY' },
          window.location.origin
        );
      } catch {}
    }

    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <html lang="it">
      <head>
        <meta charSet="utf-8" />
        <title>{title}</title>
      </head>
      <body className={`text-sm text-slate-900 ${bodyClass}`.trim()}>
        <header className="print-header flex items-center justify-between">
          <div className="flex items-center gap-3">
            {logoUrl && (
              <img 
                src={logoUrl} 
                alt="Logo" 
                style={{ height: 32 }}
                className="print-logo"
              />
            )}
            <div>
              <div className="font-semibold text-lg">{title}</div>
              {subtitle && (
                <div className="text-xs text-slate-500">{subtitle}</div>
              )}
            </div>
          </div>
          <div className="text-xs text-slate-500">
            Generato: {new Date().toLocaleString("it-IT")}
          </div>
        </header>

        <main className="print-content">
          {children}
        </main>

        <footer className="print-footer">
          <div className="flex justify-between">
            <span>Documento confidenziale – uso interno</span>
            <span>Pagina <span className="page-number"></span></span>
          </div>
        </footer>
      </body>
    </html>
  );
}
