import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import App from './App.jsx';
import './index.css';

// Production error monitoring. Errors only (no tracing/replay) to keep the
// bundle + runtime cost minimal; enabled solely when a DSN is configured
// (VITE_SENTRY_DSN in the Cloudflare Pages build env).
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    enabled: import.meta.env.PROD,
    environment: import.meta.env.MODE,
  });
  // Deploy verification hook: visiting any page with ?sentry-test=1 fires a
  // deliberate test error so you can confirm events reach the dashboard.
  if (new URLSearchParams(window.location.search).has('sentry-test')) {
    setTimeout(() => { throw new Error('Sentry frontend test event — wiring works.'); }, 1000);
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
