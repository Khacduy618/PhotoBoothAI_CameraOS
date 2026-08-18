import type { DeviceHealthSnapshot, Result } from '@momentai/shared-types';

export class WindowMiniAdminHealthService {
  async snapshot(): Promise<Result<DeviceHealthSnapshot>> {
    return {
      ok: true,
      value: {
        camera: 'unknown',
        printer: 'unknown',
        storage: 'ready',
        network: typeof navigator !== 'undefined' && navigator.onLine ? 'online' : 'unknown',
        hardwareStatus: 'not-tested',
      },
    };
  }
}
