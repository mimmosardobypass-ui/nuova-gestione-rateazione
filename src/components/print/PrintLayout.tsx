import React from "react";
import "@/styles/print.css";

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