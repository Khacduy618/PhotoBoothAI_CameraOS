import type { AdminLogLine } from '@momentai/admin-contract';
import type { Result } from '@momentai/shared-types';

export class WindowMiniAdminLogsService {
  async tail(limit = 50): Promise<Result<AdminLogLine[]>> {
    return {
      ok: true,
      value: [
        {
          timestamp: new Date().toISOString(),
          level: 'info',
          event: 'windowmini.admin.logs.skeleton',
          message: `Structured logs are not bound yet. Requested latest ${limit} lines.`,
        },
      ],
    };
  }
}
