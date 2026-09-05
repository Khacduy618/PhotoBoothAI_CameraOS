import React from 'react';
import { createRoot } from 'react-dom/client';

import './styles.css';

import { WindowMiniDesktopApp } from './App';

// ── DPI Diagnostic (visible in DevTools Console) ─────────────────────────────
// If force-device-scale-factor=1 is working: devicePixelRatio should be 1.
// If it shows 1.25 or 1.5, Windows DPI virtualization is still active.
console.log(
  `[DPI_AUDIT] devicePixelRatio=${window.devicePixelRatio}` +
  ` | screen=${window.screen.width}x${window.screen.height}` +
  ` | innerWindow=${window.innerWidth}x${window.innerHeight}` +
  ` | outerWindow=${window.outerWidth}x${window.outerHeight}` +
  (window.devicePixelRatio !== 1
    ? ' ⚠️ DPI SCALING ACTIVE — frames/circles may appear distorted'
    : ' ✅ DPI OK'),
);
// ─────────────────────────────────────────────────────────────────────────────

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('WindowMini renderer root element was not found.');

createRoot(rootElement).render(
  <React.StrictMode>
    <WindowMiniDesktopApp />
  </React.StrictMode>,
);
