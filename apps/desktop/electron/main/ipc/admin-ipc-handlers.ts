import { windowMiniAdminMainService } from '../admin/admin-main-service';
import { WINDOWMINI_IPC_CHANNELS } from './windowmini-ipc-contracts';

export interface IpcMainLike {
  handle(channel: string, listener: (...args: unknown[]) => unknown): void;
}

export function registerWindowMiniAdminIpcHandlers(ipcMain: IpcMainLike) {
  ipcMain.handle(WINDOWMINI_IPC_CHANNELS.adminUnlock, (_event, passcode) => windowMiniAdminMainService.auth.unlock(String(passcode || '')));
  ipcMain.handle(WINDOWMINI_IPC_CHANNELS.adminLock, (_event, token) => windowMiniAdminMainService.auth.lock(String(token || '')));
  ipcMain.handle(WINDOWMINI_IPC_CHANNELS.adminVerify, (_event, token) => windowMiniAdminMainService.auth.verify(String(token || '')));
  ipcMain.handle(WINDOWMINI_IPC_CHANNELS.adminEventsList, () => windowMiniAdminMainService.events.list());
  ipcMain.handle(WINDOWMINI_IPC_CHANNELS.adminEventsCreate, (_event, name) => windowMiniAdminMainService.events.create(String(name || '')));
  ipcMain.handle(WINDOWMINI_IPC_CHANNELS.adminEventsGetActive, () => windowMiniAdminMainService.events.getActive?.());
  ipcMain.handle(WINDOWMINI_IPC_CHANNELS.adminEventsSetActive, (_event, eventId) => windowMiniAdminMainService.events.setActive?.(String(eventId || '')));
  ipcMain.handle(WINDOWMINI_IPC_CHANNELS.adminEventsArchive, (_event, eventId) => windowMiniAdminMainService.events.archive?.(String(eventId || '')));
  ipcMain.handle(WINDOWMINI_IPC_CHANNELS.adminEventsRename, (_event, eventId, name) => windowMiniAdminMainService.events.rename?.(String(eventId || ''), String(name || '')));
  ipcMain.handle(WINDOWMINI_IPC_CHANNELS.adminTemplatesList, (_event, eventId) => windowMiniAdminMainService.templates.list(typeof eventId === 'string' ? eventId : undefined));
  ipcMain.handle(WINDOWMINI_IPC_CHANNELS.adminTemplatesPublish, (_event, templateId, eventId) => windowMiniAdminMainService.templates.publish(String(templateId || ''), typeof eventId === 'string' ? eventId : undefined));
  ipcMain.handle(WINDOWMINI_IPC_CHANNELS.adminTemplatesArchive, (_event, templateId, eventId) => windowMiniAdminMainService.templates.archive(String(templateId || ''), typeof eventId === 'string' ? eventId : undefined));
  ipcMain.handle(WINDOWMINI_IPC_CHANNELS.adminTemplatesSave, (_event, eventId, template) => windowMiniAdminMainService.templates.save(String(eventId || ''), template as never));
  ipcMain.handle(WINDOWMINI_IPC_CHANNELS.adminTemplatesRemove, (_event, eventId, templateId) => windowMiniAdminMainService.templates.remove(String(eventId || ''), String(templateId || '')));
  ipcMain.handle(WINDOWMINI_IPC_CHANNELS.adminTemplatesClear, (_event, eventId) => windowMiniAdminMainService.templates.clear(String(eventId || '')));
  ipcMain.handle(WINDOWMINI_IPC_CHANNELS.adminHealthSnapshot, () => windowMiniAdminMainService.health.snapshot());
  ipcMain.handle(WINDOWMINI_IPC_CHANNELS.adminCleanupSummary, () => windowMiniAdminMainService.cleanup.summary());
  ipcMain.handle(WINDOWMINI_IPC_CHANNELS.adminCleanupRunNow, () => windowMiniAdminMainService.cleanup.runNow());
  ipcMain.handle(WINDOWMINI_IPC_CHANNELS.adminLogsTail, (_event, limit) => windowMiniAdminMainService.logs.tail(Number(limit) || undefined));

  return {
    registered: true,
    channels: [
      WINDOWMINI_IPC_CHANNELS.adminUnlock,
      WINDOWMINI_IPC_CHANNELS.adminLock,
      WINDOWMINI_IPC_CHANNELS.adminVerify,
      WINDOWMINI_IPC_CHANNELS.adminEventsList,
      WINDOWMINI_IPC_CHANNELS.adminEventsCreate,
      WINDOWMINI_IPC_CHANNELS.adminEventsGetActive,
      WINDOWMINI_IPC_CHANNELS.adminEventsSetActive,
      WINDOWMINI_IPC_CHANNELS.adminEventsArchive,
      WINDOWMINI_IPC_CHANNELS.adminEventsRename,
      WINDOWMINI_IPC_CHANNELS.adminTemplatesList,
      WINDOWMINI_IPC_CHANNELS.adminTemplatesPublish,
      WINDOWMINI_IPC_CHANNELS.adminTemplatesArchive,
      WINDOWMINI_IPC_CHANNELS.adminTemplatesSave,
      WINDOWMINI_IPC_CHANNELS.adminTemplatesRemove,
      WINDOWMINI_IPC_CHANNELS.adminTemplatesClear,
      WINDOWMINI_IPC_CHANNELS.adminHealthSnapshot,
      WINDOWMINI_IPC_CHANNELS.adminCleanupSummary,
      WINDOWMINI_IPC_CHANNELS.adminCleanupRunNow,
      WINDOWMINI_IPC_CHANNELS.adminLogsTail,
    ],
  };
}
