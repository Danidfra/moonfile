import { createRoot } from 'react-dom/client';

// Import polyfills first
import './lib/polyfills.ts';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import App from './App.tsx';
import './index.css';

// TODO: a custom font should be used. Eg:
// import '@fontsource-variable/<font-name>';

// Global error capture
window.addEventListener("error", (e) => {
  console.error("[GlobalError]", e.error || e.message);
});

window.addEventListener("unhandledrejection", (e) => {
  console.error("[UnhandledRejection]", e.reason);
});

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
