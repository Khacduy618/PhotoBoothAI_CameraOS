import React from 'react';

import { WindowMiniAdminShell } from '../admin';
import { WindowMiniGuestShell } from '../guest';

export function WindowMiniDesktopApp() {
  const route = typeof window === 'undefined' ? '#/guest' : window.location.hash || '#/guest';
  if (route.includes('admin')) return <WindowMiniAdminShell />;
  return <WindowMiniGuestShell />;
}
