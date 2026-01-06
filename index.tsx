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
    // Use standard relative path.
    // Ensure sw.js is served from the same directory as index.html
    navigator.serviceWorker.register('./sw.js')
      .then((registration) => {
        console.log('SW registered with scope:', registration.scope);
      })
      .catch((registrationError) => {
        console.log('SW registration failed:', registrationError);
      });
  });
}