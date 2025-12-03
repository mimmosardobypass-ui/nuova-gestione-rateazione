import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './styles/print.css'
import 'flatpickr/dist/themes/material_blue.css'

// Force Vite cache invalidation - build timestamp: 2025-12-03T19:35:00
// Global error handlers for debugging black screen issues
console.log('🚀 [App] Starting application initialization...');

window.onerror = (message, source, lineno, colno, error) => {
  console.error('❌ [Global Error]', {
    message,
    source,
    lineno,
    colno,
    error: error?.stack || error
  });
  return false;
};

window.onunhandledrejection = (event) => {
  console.error('❌ [Unhandled Promise Rejection]', {
    reason: event.reason,
    stack: event.reason?.stack
  });
};

console.log('🔧 [App] Global error handlers registered');

try {
  const rootElement = document.getElementById("root");
  
  if (!rootElement) {
    throw new Error('Root element not found in DOM');
  }
  
  console.log('🔧 [App] Root element found, creating React root...');
  
  createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  
  console.log('✅ [App] React root created and rendering started');
} catch (error) {
  console.error('❌ CRITICAL: App failed to initialize:', error);
  document.body.innerHTML = `
    <div style="padding: 2rem; text-align: center; font-family: sans-serif; background: white; min-height: 100vh; display: flex; align-items: center; justify-content: center;">
      <div>
        <h1 style="color: #dc2626; font-size: 1.5rem; margin-bottom: 1rem;">Errore Critico</h1>
        <p style="color: #666; margin-bottom: 1rem;">L'applicazione non si è avviata correttamente.</p>
        <pre style="background: #f5f5f5; padding: 1rem; border-radius: 0.5rem; text-align: left; overflow: auto; max-width: 600px; margin: 0 auto 1.5rem;">
${error instanceof Error ? error.stack || error.message : String(error)}
        </pre>
        <button onclick="window.location.reload()" style="padding: 0.75rem 1.5rem; background: #3b82f6; color: white; border: none; border-radius: 0.375rem; cursor: pointer; font-size: 1rem;">
          Ricarica Pagina
        </button>
      </div>
    </div>
  `;
}
