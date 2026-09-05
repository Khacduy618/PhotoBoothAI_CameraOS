import React from 'react';
import { createRoot } from 'react-dom/client';

import './styles.css';

import { WindowMiniDesktopApp } from './App';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('WindowMini renderer root element was not found.');

createRoot(rootElement).render(
  <React.StrictMode>
    <WindowMiniDesktopApp />
  </React.StrictMode>,
);
