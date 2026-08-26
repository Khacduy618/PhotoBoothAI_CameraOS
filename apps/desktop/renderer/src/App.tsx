import React, { useEffect, useState } from 'react';

import { WindowMiniAdminShell } from '../admin';
import { WindowMiniGuestShell } from '../guest';

export function WindowMiniDesktopApp() {
  const [route, setRoute] = useState(() => (typeof window === 'undefined' ? '#/guest' : window.location.hash || '#/guest'));

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(window.location.hash || '#/guest');
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Global operator shortcut: Ctrl + Shift + A to toggle Admin mode on Windows & Mac
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        const nextHash = window.location.hash.includes('admin') ? '#/guest' : '#/admin';
        window.location.hash = nextHash;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (route.includes('admin')) return <WindowMiniAdminShell />;
  return <WindowMiniGuestShell />;
}
