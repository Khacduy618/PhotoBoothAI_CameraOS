import type { DeviceHealthSnapshot, Result } from '@momentai/shared-types';
import type { AdminEventSummary, AdminTemplateSummary } from '@momentai/admin-contract';

export interface WindowMiniMainWindowConfig {
  mode: 'guest' | 'admin';
  kiosk: boolean;
  width: number;
  height: number;
}

export const DEFAULT_GUEST_WINDOW: WindowMiniMainWindowConfig = {
  mode: 'guest',
  kiosk: true,
  width: 1920,
  height: 1080,
};

export const DEFAULT_ADMIN_WINDOW: WindowMiniMainWindowConfig = {
  mode: 'admin',
  kiosk: false,
  width: 1280,
  height: 900,
};

export interface WindowMiniRuntimeServices {
  healthSnapshot(): Promise<Result<DeviceHealthSnapshot>>;
  listAdminEvents(): Promise<Result<AdminEventSummary[]>>;
  listAdminTemplates(eventId?: string): Promise<Result<AdminTemplateSummary[]>>;
}

export function createWindowMiniBootstrapPlan() {
  return {
    target: 'Windows 10 x64 booth PC / Mini PC form factor',
    shell: 'Electron',
    renderer: 'Vite React',
    guestWindow: DEFAULT_GUEST_WINDOW,
    adminWindow: DEFAULT_ADMIN_WINDOW,
    adminAccess: 'hidden-shortcut-or-admin-gesture',
    hardwareStatus: 'not-tested' as const,
  };
}
