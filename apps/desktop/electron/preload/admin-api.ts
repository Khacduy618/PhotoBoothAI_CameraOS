import type { AdminApiContract } from '@momentai/admin-contract';

export type WindowMiniAdminApi = AdminApiContract;

export function createAdminApiPlaceholder(): WindowMiniAdminApi {
  const unavailable = async () => ({
    ok: false as const,
    error: {
      code: 'ADMIN_IPC_NOT_BOUND',
      domain: 'admin' as const,
      severity: 'warning' as const,
      technicalMessage: 'Electron preload admin API is a skeleton and is not bound to ipcRenderer yet.',
      guestMessage: 'Admin chưa sẵn sàng trong bản skeleton.',
      recoverable: true,
    },
  });

  return {
    auth: { unlock: unavailable, lock: unavailable, verify: unavailable },
    events: { list: unavailable, create: unavailable },
    templates: { list: unavailable, publish: unavailable, archive: unavailable, save: unavailable, remove: unavailable, clear: unavailable },
    health: { snapshot: unavailable },
    cleanup: { summary: unavailable, runNow: unavailable },
    logs: { tail: unavailable },
  };
}
