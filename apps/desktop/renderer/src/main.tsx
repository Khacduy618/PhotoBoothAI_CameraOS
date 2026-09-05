import React from 'react';
import { createRoot } from 'react-dom/client';

import './styles.css';

import { WindowMiniDesktopApp } from './App';

// ── DPI Diagnostic (visible in DevTools Console) ─────────────────────────────
// If force-device-scale-factor=1 is working: devicePixelRatio should be 1.
// If it shows 1.25 or 1.5, Windows DPI virtualization is still active.
const scrollbarW = window.innerWidth - document.documentElement.clientWidth;
const scrollbarH = window.innerHeight - document.documentElement.clientHeight;
console.log(
  `[DPI_AUDIT] devicePixelRatio=${window.devicePixelRatio}` +
  ` | screen=${window.screen.width}x${window.screen.height}` +
  ` | innerWindow=${window.innerWidth}x${window.innerHeight}` +
  ` | outerWindow=${window.outerWidth}x${window.outerHeight}` +
  ` | scrollbarW=${scrollbarW}px scrollbarH=${scrollbarH}px` +
  (scrollbarW > 0 ? ' ⚠️ SCROLLBAR STEALING WIDTH' : ' ✅ NO SCROLLBAR WIDTH') +
  (window.devicePixelRatio !== 1 ? ' | ⚠️ DPI SCALING ACTIVE' : ' | ✅ DPI=1'),
);
// ─────────────────────────────────────────────────────────────────────────────

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('WindowMini renderer root element was not found.');

createRoot(rootElement).render(
  <React.StrictMode>
    <WindowMiniDesktopApp />
  </React.StrictMode>,
);
