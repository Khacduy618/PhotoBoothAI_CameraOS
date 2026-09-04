export type MomentAIHardwareStatus = 'not-tested' | 'partial' | 'pass' | 'fail';

export type MomentAIErrorDomain =
  | 'camera'
  | 'capture'
  | 'printer'
  | 'storage'
  | 'template'
  | 'composition'
  | 'qr'
  | 'network'
  | 'admin'
  | 'platform';

export interface MomentAIError {
  code: string;
  domain: MomentAIErrorDomain;
  severity: 'warning' | 'blocking';
  technicalMessage: string;
  guestMessage: string;
  recoverable: boolean;
}

export type Result<T, E = MomentAIError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export interface DeviceHealthSnapshot {
  camera: 'unknown' | 'ready' | 'busy' | 'offline' | 'error';
  printer: 'unknown' | 'ready' | 'printing' | 'offline' | 'error';
  storage: 'unknown' | 'ready' | 'low-space' | 'error';
  network: 'unknown' | 'online' | 'offline';
  hardwareStatus: MomentAIHardwareStatus;
}

export interface PersistedMediaRef {
  id: string;
  sessionId: string;
  relativePath: string;
  mimeType: string;
  width?: number;
  height?: number;
  bytes?: number;
  createdAt: string;
}

export type PrintPolicy = 'DISABLED' | 'GUEST_CONFIRM';

export type ShareMode = 'DISABLED' | 'CLOUD_LANDING_PAGE' | 'LOCAL_NETWORK_URL';

export type KioskMode = 'WINDOWED_DEV' | 'FULLSCREEN_KIOSK';

export type PrintFailurePolicy = 'STOP_QUEUE_REQUIRE_MANUAL_REPRINT';

export interface SharePolicyConfig {
  mode: ShareMode;
  cloudProvider?: 'VERCEL_NEON_R2';
  qrTokenTtlMinutes: number;
  cleanupAfterMinutes: number;
  localFallbackEnabled: boolean;
}

export interface PrintQueuePolicyConfig {
  failurePolicy: PrintFailurePolicy;
  autoRetry: false;
  stopOnFailure: true;
  manualReprintRequired: true;
  warnPendingJobs: number;
  criticalPendingJobs: number;
}

export interface ProductionRuntimeConfig {
  platform: 'windows_exe' | 'dev';
  dataRoot: 'LOCALAPPDATA' | 'DEV_ARTIFACTS' | 'CUSTOM';
  customDataRoot?: string;
  kioskMode: KioskMode;
  startupAutoLaunch: boolean;
}

export interface EventPrintConfig {
  policy: PrintPolicy;
  provider: 'windows_print' | 'fake' | 'disabled';
  certifiedPrinterTarget: 'CANON_SELPHY_CP1000';
  draftCopyPolicy: {
    premium: 2;
    sheet: 2;
    strip: 1;
    finalDesignApproved: boolean;
  };
  queue: PrintQueuePolicyConfig;
}

export interface MomentAIEventConfig {
  eventId: string;
  name: string;
  enabledShotFormats: string[];
  share: SharePolicyConfig;
  print: EventPrintConfig;
  runtime: ProductionRuntimeConfig;
  allowGuestRetake: false;
  maxRetakesPerShot: 0;
}

export function createDefaultV1EventConfig(input: { eventId: string; name: string }): MomentAIEventConfig {
  return {
    eventId: input.eventId,
    name: input.name,
    enabledShotFormats: ['format_1shot', 'format_2shot', 'format_4shot', 'format_6shot'],
    share: {
      mode: 'CLOUD_LANDING_PAGE',
      cloudProvider: 'VERCEL_NEON_R2',
      qrTokenTtlMinutes: 10,
      cleanupAfterMinutes: 30,
      localFallbackEnabled: true,
    },
    print: {
      policy: 'GUEST_CONFIRM',
      provider: 'windows_print',
      certifiedPrinterTarget: 'CANON_SELPHY_CP1000',
      draftCopyPolicy: {
        premium: 2,
        sheet: 2,
        strip: 1,
        finalDesignApproved: false,
      },
      queue: {
        failurePolicy: 'STOP_QUEUE_REQUIRE_MANUAL_REPRINT',
        autoRetry: false,
        stopOnFailure: true,
        manualReprintRequired: true,
        warnPendingJobs: 5,
        criticalPendingJobs: 10,
      },
    },
    runtime: {
      platform: 'windows_exe',
      dataRoot: 'LOCALAPPDATA',
      kioskMode: 'FULLSCREEN_KIOSK',
      startupAutoLaunch: true,
    },
    allowGuestRetake: false,
    maxRetakesPerShot: 0,
  };
}
