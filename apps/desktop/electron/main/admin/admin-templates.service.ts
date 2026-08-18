import { listAdminFrames, updateAdminFrameStatus } from '@/services/admin/server/admin-registry-store';
import type { AdminTemplateSummary } from '@momentai/admin-contract';
import type { Result } from '@momentai/shared-types';

function assertAdminId(value: string, label: string): string {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(value)) throw new Error(`Invalid ${label}.`);
  return value;
}

const inMemoryTemplates = new Map<string, AdminTemplateSummary & Record<string, unknown>>();

function templateKey(eventId: string, templateId: string): string {
  return `${eventId}::${templateId}`;
}

function templateResultError(cause: unknown, code: string, guestMessage: string): Result<void> {
  return {
    ok: false,
    error: {
      code,
      domain: 'admin',
      severity: 'warning',
      technicalMessage: cause instanceof Error ? cause.message : 'Admin template operation failed.',
      guestMessage,
      recoverable: true,
    },
  };
}

export class WindowMiniAdminTemplatesService {
  async list(eventId?: string): Promise<Result<AdminTemplateSummary[]>> {
    const scopedEventId = eventId ? assertAdminId(eventId, 'event id') : undefined;
    const templates = listAdminFrames(scopedEventId).map((frame) => ({
      templateId: frame.id,
      eventId: frame.eventId,
      name: frame.name,
      captureFormatId: `format_${frame.shotCount}shot`,
      status: frame.status === 'private' ? 'private' as const : 'published' as const,
      allowTyping: false,
      allowDraw: Boolean(frame.allowDraw),
    }));
    const memoryTemplates = Array.from(inMemoryTemplates.values()).filter((template) => !scopedEventId || template.eventId === scopedEventId);
    return { ok: true, value: [...templates, ...memoryTemplates] };
  }

  async publish(templateId: string, eventId = 'event_hoi_an_heritage'): Promise<Result<void>> {
    return this.updateStatus(templateId, eventId, 'published');
  }

  async archive(templateId: string, eventId = 'event_hoi_an_heritage'): Promise<Result<void>> {
    return this.updateStatus(templateId, eventId, 'private');
  }

  async save(eventId: string, template: AdminTemplateSummary & Record<string, unknown>): Promise<Result<void>> {
    try {
      const scopedEventId = assertAdminId(eventId, 'event id');
      const templateId = assertAdminId(String(template.templateId || template.id || ''), 'template id');
      inMemoryTemplates.set(templateKey(scopedEventId, templateId), {
        ...template,
        templateId,
        eventId: scopedEventId,
        status: template.status === 'private' ? 'private' : 'published',
      });
      return { ok: true, value: undefined };
    } catch (cause) {
      return templateResultError(cause, 'ADMIN_TEMPLATE_SAVE_FAILED', 'Không lưu được template admin.');
    }
  }

  async remove(eventId: string, templateId: string): Promise<Result<void>> {
    try {
      const scopedEventId = assertAdminId(eventId, 'event id');
      const id = assertAdminId(templateId, 'template id');
      const key = templateKey(scopedEventId, id);
      const template = inMemoryTemplates.get(key);
      if (!template) throw new Error('Template not found for event.');
      inMemoryTemplates.delete(key);
      return { ok: true, value: undefined };
    } catch (cause) {
      return templateResultError(cause, 'ADMIN_TEMPLATE_REMOVE_FAILED', 'Không xoá được template admin.');
    }
  }

  async clear(eventId: string): Promise<Result<void>> {
    try {
      const scopedEventId = assertAdminId(eventId, 'event id');
      for (const [templateId, template] of inMemoryTemplates.entries()) {
        if (template.eventId === scopedEventId) inMemoryTemplates.delete(templateId);
      }
      return { ok: true, value: undefined };
    } catch (cause) {
      return templateResultError(cause, 'ADMIN_TEMPLATE_CLEAR_FAILED', 'Không xoá được danh sách template admin.');
    }
  }

  private async updateStatus(templateId: string, eventId: string, status: 'published' | 'private'): Promise<Result<void>> {
    try {
      const id = assertAdminId(templateId, 'template id');
      const scopedEventId = assertAdminId(eventId, 'event id');
      const key = templateKey(scopedEventId, id);
      const memoryTemplate = inMemoryTemplates.get(key);
      if (memoryTemplate) {
        inMemoryTemplates.set(key, { ...memoryTemplate, status });
        return { ok: true, value: undefined };
      }
      updateAdminFrameStatus(id, status, scopedEventId);
      return { ok: true, value: undefined };
    } catch (cause) {
      return {
        ok: false,
        error: {
          code: 'ADMIN_TEMPLATE_STATUS_FAILED',
          domain: 'admin',
          severity: 'warning',
          technicalMessage: cause instanceof Error ? cause.message : 'Unable to update template status.',
          guestMessage: 'Không cập nhật được trạng thái template.',
          recoverable: true,
        },
      };
    }
  }
}
