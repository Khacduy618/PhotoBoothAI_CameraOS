import type { MomentAICaptureFormatId, MomentAICustomization, MomentAIGuestPhoto } from '@/types/momentai-guest-session';

import { windowMiniGuestSessionMainService } from '../session/guest-session-main-service';
import { WINDOWMINI_IPC_CHANNELS } from './windowmini-ipc-contracts';
import type { IpcMainLike } from './admin-ipc-handlers';

export function registerWindowMiniGuestSessionIpcHandlers(ipcMain: IpcMainLike) {
  ipcMain.handle(WINDOWMINI_IPC_CHANNELS.guestGetReadiness, () => windowMiniGuestSessionMainService.getReadiness());
  ipcMain.handle(WINDOWMINI_IPC_CHANNELS.guestStartSession, (_event, eventId) => windowMiniGuestSessionMainService.startSession(typeof eventId === 'string' ? eventId : undefined));
  ipcMain.handle(WINDOWMINI_IPC_CHANNELS.guestGetSession, (_event, sessionId) => windowMiniGuestSessionMainService.getSession(String(sessionId || '')));
  ipcMain.handle(WINDOWMINI_IPC_CHANNELS.guestListCaptureFormats, () => windowMiniGuestSessionMainService.listCaptureFormats());
  ipcMain.handle(WINDOWMINI_IPC_CHANNELS.guestSelectFormat, (_event, sessionId, formatId) => windowMiniGuestSessionMainService.selectFormat(String(sessionId || ''), String(formatId || '') as MomentAICaptureFormatId));
  ipcMain.handle(WINDOWMINI_IPC_CHANNELS.guestAddPhoto, (_event, sessionId, photo) => windowMiniGuestSessionMainService.addPhoto(String(sessionId || ''), photo as Omit<MomentAIGuestPhoto, 'sessionId' | 'status' | 'capturedAt'>));
  ipcMain.handle(WINDOWMINI_IPC_CHANNELS.guestListTemplates, (_event, eventId, captureFormatId) => windowMiniGuestSessionMainService.listTemplates(String(eventId || ''), String(captureFormatId || '') as MomentAICaptureFormatId));
  ipcMain.handle(WINDOWMINI_IPC_CHANNELS.guestSelectTemplate, (_event, sessionId, templateId) => windowMiniGuestSessionMainService.selectTemplate(String(sessionId || ''), String(templateId || '')));
  ipcMain.handle(WINDOWMINI_IPC_CHANNELS.guestSaveCustomization, (_event, sessionId, customization) => windowMiniGuestSessionMainService.saveCustomization(String(sessionId || ''), customization as MomentAICustomization));
  ipcMain.handle(WINDOWMINI_IPC_CHANNELS.guestCompose, (_event, sessionId) => windowMiniGuestSessionMainService.compose(String(sessionId || '')));
  ipcMain.handle(WINDOWMINI_IPC_CHANNELS.guestRequestPrint, (_event, sessionId, copies) => windowMiniGuestSessionMainService.requestPrint(String(sessionId || ''), Number(copies) || 1));
  ipcMain.handle(WINDOWMINI_IPC_CHANNELS.guestComplete, (_event, sessionId) => windowMiniGuestSessionMainService.complete(String(sessionId || '')));

  return { registered: true, channels: Object.values(WINDOWMINI_IPC_CHANNELS).filter((channel) => channel.startsWith('cameraos:guest:')) };
}
