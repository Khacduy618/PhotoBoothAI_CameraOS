import type { WindowMiniAdminApi } from '@/apps/desktop/electron/preload/admin-api';

export interface WindowMiniAdminViewModel {
  source: 'electron-preload' | 'next-fallback';
  api?: WindowMiniAdminApi;
}

export function getWindowMiniAdminViewModel(): WindowMiniAdminViewModel {
  if (typeof window !== 'undefined' && window.momentai?.admin) {
    return { source: 'electron-preload', api: window.momentai.admin };
  }

  return { source: 'next-fallback' };
}
