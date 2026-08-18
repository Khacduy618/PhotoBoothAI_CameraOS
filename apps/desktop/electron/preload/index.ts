import { createAdminApiPlaceholder, type WindowMiniAdminApi } from './admin-api';
import { createGuestApiPlaceholder, type WindowMiniGuestApi } from './guest-api';

export interface WindowMiniPreloadApi {
  guest: WindowMiniGuestApi;
  admin: WindowMiniAdminApi;
}

export function createWindowMiniPreloadApi(): WindowMiniPreloadApi {
  return {
    guest: createGuestApiPlaceholder(),
    admin: createAdminApiPlaceholder(),
  };
}

declare global {
  interface Window {
    momentai?: WindowMiniPreloadApi;
  }
}

export const windowMiniPreloadApi = createWindowMiniPreloadApi();
