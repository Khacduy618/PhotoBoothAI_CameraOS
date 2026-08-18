import type { BinaryImage, OutputType } from '@momentai/storage-contract';

import { windowMiniImageStorageMainService } from '../storage/image-storage-main-service';
import type { IpcMainLike } from './admin-ipc-handlers';
import { WINDOWMINI_IPC_CHANNELS } from './windowmini-ipc-contracts';

export function registerWindowMiniStorageIpcHandlers(ipcMain: IpcMainLike) {
  ipcMain.handle(WINDOWMINI_IPC_CHANNELS.storageHealth, () => windowMiniImageStorageMainService.getHealth());
  ipcMain.handle(WINDOWMINI_IPC_CHANNELS.storageCreateSession, (_event, sessionId) => windowMiniImageStorageMainService.createSession(String(sessionId || '')));
  ipcMain.handle(WINDOWMINI_IPC_CHANNELS.storageSaveOriginal, (_event, sessionId, shotIndex, photo) => windowMiniImageStorageMainService.saveOriginal(String(sessionId || ''), Number(shotIndex) || 1, photo as BinaryImage));
  ipcMain.handle(WINDOWMINI_IPC_CHANNELS.storageSaveOutput, (_event, sessionId, type, file) => windowMiniImageStorageMainService.saveOutput(String(sessionId || ''), String(type || 'preview') as OutputType, file as BinaryImage));

  return { registered: true, channels: [WINDOWMINI_IPC_CHANNELS.storageHealth, WINDOWMINI_IPC_CHANNELS.storageCreateSession, WINDOWMINI_IPC_CHANNELS.storageSaveOriginal, WINDOWMINI_IPC_CHANNELS.storageSaveOutput] };
}
