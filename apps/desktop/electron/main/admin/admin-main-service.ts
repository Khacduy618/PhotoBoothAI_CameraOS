import type { AdminApiContract } from '@momentai/admin-contract';

import { WindowMiniAdminAuthService } from './admin-auth.service';
import { WindowMiniAdminCleanupService } from './admin-cleanup.service';
import { WindowMiniAdminEventsService } from './admin-events.service';
import { WindowMiniAdminHealthService } from './admin-health.service';
import { WindowMiniAdminLogsService } from './admin-logs.service';
import { WindowMiniAdminTemplatesService } from './admin-templates.service';

export class WindowMiniAdminMainService implements AdminApiContract {
  private readonly authService = new WindowMiniAdminAuthService();
  private readonly eventsService = new WindowMiniAdminEventsService();
  private readonly templatesService = new WindowMiniAdminTemplatesService();
  private readonly healthService = new WindowMiniAdminHealthService();
  private readonly cleanupService = new WindowMiniAdminCleanupService();
  private readonly logsService = new WindowMiniAdminLogsService();

  public readonly auth: AdminApiContract['auth'] = {
    unlock: (passcode) => this.authService.unlock(passcode),
    lock: (token) => this.authService.lock(token),
    verify: (token) => this.authService.verify(token),
  };

  public readonly events: AdminApiContract['events'] = {
    list: () => this.eventsService.list(),
    create: (name) => this.eventsService.create(name),
  };

  public readonly templates: AdminApiContract['templates'] = {
    list: (eventId) => this.templatesService.list(eventId),
    publish: (templateId, eventId) => this.templatesService.publish(templateId, eventId),
    archive: (templateId, eventId) => this.templatesService.archive(templateId, eventId),
    save: (eventId, template) => this.templatesService.save(eventId, template),
    remove: (eventId, templateId) => this.templatesService.remove(eventId, templateId),
    clear: (eventId) => this.templatesService.clear(eventId),
  };

  public readonly health: AdminApiContract['health'] = {
    snapshot: () => this.healthService.snapshot(),
  };

  public readonly cleanup: AdminApiContract['cleanup'] = {
    summary: () => this.cleanupService.summary(),
    runNow: () => this.cleanupService.runNow(),
  };

  public readonly logs: AdminApiContract['logs'] = {
    tail: (limit) => this.logsService.tail(limit),
  };
}

export const windowMiniAdminMainService = new WindowMiniAdminMainService();
