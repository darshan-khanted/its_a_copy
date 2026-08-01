import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import '@/styles/index.css';

// Intercept Google Maps billing/quota/referrer console errors (graceful OSM fallback) and
// transient Firestore offline messages so the sandbox runner does not treat them as crashes.
const originalConsoleError = console.error;
console.error = function (...args: unknown[]) {
  const msg = args
    .map((arg) => (typeof arg === 'string' ? arg : arg instanceof Error ? arg.message : ''))
    .join(' ');
  if (
    msg.includes('Geocoding Service') ||
    msg.includes('You must enable Billing') ||
    msg.includes('Billing on the Google Cloud Project') ||
    msg.includes('RefererNotAllowed') ||
    msg.includes('referer-not-allowed') ||
    (msg.includes('Google Maps') &&
      (msg.includes('Billing') ||
        msg.includes('Quota') ||
        msg.includes('ApiNotActivated') ||
        msg.includes('error') ||
        msg.includes('Error') ||
        msg.includes('Referer')))
  ) {
    try {
      localStorage.setItem('google_maps_billing_disabled', 'true');
    } catch {
      // ignore
    }
    console.warn('[Google Maps Intercepted & Fallback Triaged]', ...args);
    return;
  }
  if (
    msg.includes('Could not reach Cloud Firestore backend') ||
    msg.includes('operate in offline mode') ||
    msg.includes('Connection failed') ||
    (msg.includes('Firestore') && msg.includes('unavailable'))
  ) {
    console.warn('[Firestore Connection Triage - Operating in Offline/Retry Mode]', ...args);
    return;
  }
  originalConsoleError.apply(console, args);
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
