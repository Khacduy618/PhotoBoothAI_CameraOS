import { createAdminEvent, listAdminEvents } from '@/services/admin/server/admin-registry-store';
import type { AdminEventSummary } from '@momentai/admin-contract';
import type { Result } from '@momentai/shared-types';

export class WindowMiniAdminEventsService {
  async list(): Promise<Result<AdminEventSummary[]>> {
    return { ok: true, value: listAdminEvents().map((event) => ({ ...event })) };
  }

  async create(name: string): Promise<Result<AdminEventSummary>> {
    try {
      return { ok: true, value: createAdminEvent(name) };
    } catch (cause) {
      return {
        ok: false,
        error: {
          code: 'ADMIN_EVENT_CREATE_FAILED',
          domain: 'admin',
          severity: 'warning',
          technicalMessage: cause instanceof Error ? cause.message : 'Unable to create admin event.',
          guestMessage: 'Không tạo được event admin.',
          recoverable: true,
        },
      };
    }
  }
}
