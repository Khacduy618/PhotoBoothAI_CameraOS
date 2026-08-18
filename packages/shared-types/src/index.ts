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
