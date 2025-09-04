import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './styles/print.css'
import 'flatpickr/dist/themes/material_blue.css'

createRoot(document.getElementById("root")!).render(<App />);
