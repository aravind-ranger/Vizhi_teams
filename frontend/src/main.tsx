import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Force reload when dynamic imports fail (usually due to stale hashes after a deploy)
window.addEventListener('error', (e) => {
  if (e.message.includes('Failed to fetch dynamically imported module') || 
      e.message.includes('Importing a module script failed')) {
    window.location.reload();
  }
}, true);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
