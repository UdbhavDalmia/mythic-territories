import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { getMotionPreference, applyMotionPreference } from './services/motionPreference.js';

// Initialize user motion preference immediately on startup
applyMotionPreference(getMotionPreference());

// Register offline caching service worker in supported browser environments
if (typeof window !== 'undefined' && 'serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.info('Service Worker registration skipped:', err);
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
