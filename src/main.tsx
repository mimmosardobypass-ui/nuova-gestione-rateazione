import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './styles/print.css'
import 'flatpickr/dist/themes/material_blue.css'

try {
  createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} catch (error) {
  console.error('❌ CRITICAL: App failed to initialize:', error);
  document.body.innerHTML = `
    <div style="padding: 2rem; text-align: center; font-family: sans-serif; background: white; min-height: 100vh; display: flex; align-items: center; justify-content: center;">
      <div>
        <h1 style="color: #dc2626; font-size: 1.5rem; margin-bottom: 1rem;">Errore Critico</h1>
        <p style="color: #666; margin-bottom: 1.5rem;">L'applicazione non si è avviata correttamente.</p>
        <button onclick="window.location.reload()" style="padding: 0.75rem 1.5rem; background: #3b82f6; color: white; border: none; border-radius: 0.375rem; cursor: pointer; font-size: 1rem;">
          Ricarica Pagina
        </button>
      </div>
    </div>
  `;
}
