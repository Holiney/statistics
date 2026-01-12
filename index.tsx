import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Force absolute URL resolution relative to window.location to prevent "Origin mismatch" errors
    // in environments where path resolution or bundlers might interfere with relative paths.
    const swUrl = new URL('./sw.js', window.location.href).href;

    navigator.serviceWorker.register(swUrl)
      .then((registration) => {
        console.log('SW registered with scope:', registration.scope);
      })
      .catch((registrationError) => {
        console.log('SW registration failed:', registrationError);
      });
  });
}