import type { MediaCleanupResult, MediaCleanupSummary } from '@momentai/storage-contract';
import type { DeviceHealthSnapshot, Result } from '@momentai/shared-types';

export interface AdminEventSummary {
  eventId: string;
  name: string;
  status: 'active' | 'archived';
  isActive?: boolean;
  frameCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminTemplateSummary {
  templateId: string;
  eventId: string;
  name: string;
  captureFormatId: string;
  status: 'draft' | 'published' | 'archived' | 'private';
  allowTyping: boolean;
  allowDraw: boolean;
}

export interface AdminLogLine {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  event: string;
  message: string;
}

export interface AdminSessionToken {
  token: string;
  expiresAt: string;
}

export interface AdminApiContract {
  auth: {
    unlock(passcode: string): Promise<Result<AdminSessionToken>>;
    lock(token: string): Promise<Result<void>>;
    verify(token: string): Promise<Result<void>>;
  };
  events: {
    list(): Promise<Result<AdminEventSummary[]>>;
    create(name: string): Promise<Result<AdminEventSummary>>;
    getActive?(): Promise<Result<string>>;
    setActive?(eventId: string): Promise<Result<void>>;
    archive?(eventId: string): Promise<Result<void>>;
    rename?(eventId: string, name: string): Promise<Result<AdminEventSummary>>;
  };
  templates: {
    list(eventId?: string): Promise<Result<AdminTemplateSummary[]>>;
    publish(templateId: string, eventId?: string): Promise<Result<void>>;
    archive(templateId: string, eventId?: string): Promise<Result<void>>;
    save(eventId: string, template: AdminTemplateSummary & Record<string, unknown>): Promise<Result<void>>;
    remove(eventId: string, templateId: string): Promise<Result<void>>;
    clear(eventId: string): Promise<Result<void>>;
  };
  health: {
    snapshot(): Promise<Result<DeviceHealthSnapshot>>;
  };
  cleanup: {
    summary(): Promise<Result<MediaCleanupSummary>>;
    runNow(): Promise<Result<MediaCleanupResult[]>>;
  };
  logs: {
    tail(limit?: number): Promise<Result<AdminLogLine[]>>;
  };
}
