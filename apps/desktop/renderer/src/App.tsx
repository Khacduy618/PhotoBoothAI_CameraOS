import React, { useEffect, useState } from 'react';

import { WindowMiniAdminShell } from '../admin';
import { WindowMiniGuestShell } from '../guest';
import { CP1000ColorTestModal } from '@/components/dev/CP1000ColorTestModal';

export function WindowMiniDesktopApp() {
  const [route, setRoute] = useState(() => (typeof window === 'undefined' ? '#/guest' : window.location.hash || '#/guest'));
  const [isColorTestOpen, setIsColorTestOpen] = useState(false);

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(window.location.hash || '#/guest');
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Global operator shortcuts on Windows & Mac:
  //  - Ctrl + Shift + A: Toggle Admin Shell
  //  - Ctrl + Shift + C: Toggle CP1000 Color Test Modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        const nextHash = window.location.hash.includes('admin') ? '#/guest' : '#/admin';
        window.location.hash = nextHash;
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'C' || e.key === 'c')) {
        e.preventDefault();
        setIsColorTestOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      {route.includes('admin') ? <WindowMiniAdminShell /> : <WindowMiniGuestShell />}
      <CP1000ColorTestModal
        isOpen={isColorTestOpen}
        onClose={() => setIsColorTestOpen(false)}
      />
    </>
  );
}
