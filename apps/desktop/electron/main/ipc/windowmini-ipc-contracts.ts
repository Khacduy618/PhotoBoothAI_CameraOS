import type { AdminApiContract } from '@momentai/admin-contract';
import type { CameraAdapter } from '@momentai/camera-contract';
import type { PrinterAdapter } from '@momentai/printer-contract';
import type { StorageAdapter } from '@momentai/storage-contract';
import type { DeviceHealthSnapshot } from '@momentai/shared-types';

export interface WindowMiniIpcContracts {
  camera: Pick<CameraAdapter, 'getStatus' | 'startLiveView' | 'stopLiveView' | 'capture'>;
  printer: Pick<PrinterAdapter, 'getPrinters' | 'getStatus' | 'print'>;
  storage: Pick<StorageAdapter, 'getHealth' | 'createSession' | 'saveOriginal' | 'saveOutput'>;
  admin: AdminApiContract;
  health: {
    snapshot(): Promise<DeviceHealthSnapshot>;
  };
}

export const WINDOWMINI_IPC_CHANNELS = {
  guestGetReadiness: 'cameraos:guest:readiness:get',
  guestStartSession: 'cameraos:guest:session:start',
  guestGetSession: 'cameraos:guest:session:get',
  guestListCaptureFormats: 'cameraos:guest:capture-formats:list',
  guestSelectFormat: 'cameraos:guest:format:select',
  guestAddPhoto: 'cameraos:guest:photo:add',
  guestListTemplates: 'cameraos:guest:templates:list',
  guestSelectTemplate: 'cameraos:guest:template:select',
  guestSaveCustomization: 'cameraos:guest:customization:save',
  guestCompose: 'cameraos:guest:compose',
  guestRequestPrint: 'cameraos:guest:print:request',
  guestComplete: 'cameraos:guest:complete',
  cameraStatus: 'cameraos:camera:status',
  cameraCapture: 'cameraos:camera:capture',
  printerStatus: 'cameraos:printer:status',
  printerPrint: 'cameraos:printer:print',
  storageHealth: 'cameraos:storage:health',
  storageCreateSession: 'cameraos:storage:session:create',
  storageSaveOriginal: 'cameraos:storage:original:save',
  storageSaveOutput: 'cameraos:storage:output:save',
  adminUnlock: 'cameraos:admin:auth:unlock',
  adminLock: 'cameraos:admin:auth:lock',
  adminVerify: 'cameraos:admin:auth:verify',
  adminEventsList: 'cameraos:admin:events:list',
  adminEventsCreate: 'cameraos:admin:events:create',
  adminEventsGetActive: 'cameraos:admin:events:get-active',
  adminEventsSetActive: 'cameraos:admin:events:set-active',
  adminEventsArchive: 'cameraos:admin:events:archive',
  adminEventsRename: 'cameraos:admin:events:rename',
  adminTemplatesList: 'cameraos:admin:templates:list',
  adminTemplatesPublish: 'cameraos:admin:templates:publish',
  adminTemplatesArchive: 'cameraos:admin:templates:archive',
  adminTemplatesSave: 'cameraos:admin:templates:save',
  adminTemplatesRemove: 'cameraos:admin:templates:remove',
  adminTemplatesClear: 'cameraos:admin:templates:clear',
  adminHealthSnapshot: 'cameraos:admin:health:snapshot',
  adminCleanupSummary: 'cameraos:admin:cleanup:summary',
  adminCleanupRunNow: 'cameraos:admin:cleanup:run-now',
  adminLogsTail: 'cameraos:admin:logs:tail',
} as const;

export function registerWindowMiniIpcHandlers() {
  return {
    registered: false,
    reason: 'Skeleton only. Bind Electron ipcMain handlers after desktop runtime dependencies are installed.',
    channels: WINDOWMINI_IPC_CHANNELS,
  };
}
