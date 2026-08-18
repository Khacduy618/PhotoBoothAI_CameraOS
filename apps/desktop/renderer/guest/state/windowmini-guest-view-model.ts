import type { WindowMiniGuestApi } from '@/apps/desktop/electron/preload/guest-api';

export interface WindowMiniGuestViewModel {
  source: 'electron-preload' | 'next-fallback';
  api?: WindowMiniGuestApi;
}

export function getWindowMiniGuestViewModel(): WindowMiniGuestViewModel {
  if (typeof window !== 'undefined' && window.momentai?.guest) {
    return { source: 'electron-preload', api: window.momentai.guest };
  }

  return { source: 'next-fallback' };
}
