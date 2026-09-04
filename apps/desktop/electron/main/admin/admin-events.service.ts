import {
  archiveAdminEvent,
  createAdminEvent,
  getActiveAdminEventId,
  listAdminEvents,
  renameAdminEvent,
  setActiveAdminEvent,
} from '@/services/admin/server/admin-registry-store';
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

  async getActive(): Promise<Result<string>> {
    try {
      return { ok: true, value: getActiveAdminEventId() };
    } catch (cause) {
      return {
        ok: false,
        error: {
          code: 'ADMIN_EVENT_GET_ACTIVE_FAILED',
          domain: 'admin',
          severity: 'warning',
          technicalMessage: cause instanceof Error ? cause.message : 'Unable to get active admin event.',
          guestMessage: 'Không lấy được event active.',
          recoverable: true,
        },
      };
    }
  }

  async setActive(eventId: string): Promise<Result<void>> {
    try {
      setActiveAdminEvent(eventId);
      return { ok: true, value: undefined };
    } catch (cause) {
      return {
        ok: false,
        error: {
          code: 'ADMIN_EVENT_SET_ACTIVE_FAILED',
          domain: 'admin',
          severity: 'warning',
          technicalMessage: cause instanceof Error ? cause.message : 'Unable to set active admin event.',
          guestMessage: 'Không đặt được event active.',
          recoverable: true,
        },
      };
    }
  }

  async archive(eventId: string): Promise<Result<void>> {
    try {
      archiveAdminEvent(eventId);
      return { ok: true, value: undefined };
    } catch (cause) {
      return {
        ok: false,
        error: {
          code: 'ADMIN_EVENT_ARCHIVE_FAILED',
          domain: 'admin',
          severity: 'warning',
          technicalMessage: cause instanceof Error ? cause.message : 'Unable to archive admin event.',
          guestMessage: 'Không lưu trữ được event.',
          recoverable: true,
        },
      };
    }
  }

  async rename(eventId: string, name: string): Promise<Result<AdminEventSummary>> {
    try {
      const record = renameAdminEvent(eventId, name);
      return { ok: true, value: record };
    } catch (cause) {
      return {
        ok: false,
        error: {
          code: 'ADMIN_EVENT_RENAME_FAILED',
          domain: 'admin',
          severity: 'warning',
          technicalMessage: cause instanceof Error ? cause.message : 'Unable to rename admin event.',
          guestMessage: 'Không đổi tên được event.',
          recoverable: true,
        },
      };
    }
  }
}
