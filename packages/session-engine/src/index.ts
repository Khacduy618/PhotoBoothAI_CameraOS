import type { CaptureFormatId } from '@momentai/shot-engine';
import type { MomentAIError, PersistedMediaRef, Result } from '@momentai/shared-types';

export type GuestSessionState =
  | 'IDLE'
  | 'CREATED'
  | 'SELECTING_FORMAT'
  | 'READY_TO_CAPTURE'
  | 'CAPTURING'
  | 'SELECTING_TEMPLATE'
  | 'CUSTOMIZING'
  | 'COMPOSING'
  | 'RESULT_READY'
  | 'COMPLETED'
  | 'RESETTING'
  | 'ERROR';

export type GuestSessionEvent =
  | { type: 'CREATE_SESSION'; sessionId: string; eventId: string }
  | { type: 'SELECT_FORMAT'; formatId: CaptureFormatId }
  | { type: 'START_CAPTURE' }
  | { type: 'CAPTURE_COMPLETE'; photos: PersistedMediaRef[] }
  | { type: 'SELECT_TEMPLATE'; templateId: string; allowsCustomization: boolean }
  | { type: 'SAVE_CUSTOMIZATION' }
  | { type: 'START_COMPOSITION' }
  | { type: 'COMPOSITION_COMPLETE'; outputs: { master: PersistedMediaRef; share: PersistedMediaRef; print: PersistedMediaRef } }
  | { type: 'COMPLETE_SESSION' }
  | { type: 'RESET_GUEST' }
  | { type: 'FAIL'; error: MomentAIError };

export interface GuestSessionModel {
  sessionId: string;
  eventId: string;
  state: GuestSessionState;
  captureFormatId?: CaptureFormatId;
  photos: PersistedMediaRef[];
  selectedTemplateId?: string;
  outputs?: {
    master: PersistedMediaRef;
    share: PersistedMediaRef;
    print: PersistedMediaRef;
  };
  lastError?: MomentAIError;
}

export function createIdleSession(): GuestSessionModel {
  return { sessionId: '', eventId: '', state: 'IDLE', photos: [] };
}

export function reduceGuestSession(session: GuestSessionModel, event: GuestSessionEvent): Result<GuestSessionModel> {
  switch (event.type) {
    case 'CREATE_SESSION':
      if (session.state !== 'IDLE' && session.state !== 'COMPLETED' && session.state !== 'RESETTING') return invalid(session.state, event.type);
      return ok({ sessionId: event.sessionId, eventId: event.eventId, state: 'SELECTING_FORMAT', photos: [] });
    case 'SELECT_FORMAT':
      if (session.state !== 'SELECTING_FORMAT') return invalid(session.state, event.type);
      return ok({ ...session, captureFormatId: event.formatId, state: 'READY_TO_CAPTURE' });
    case 'START_CAPTURE':
      if (session.state !== 'READY_TO_CAPTURE' || !session.captureFormatId) return invalid(session.state, event.type);
      return ok({ ...session, state: 'CAPTURING' });
    case 'CAPTURE_COMPLETE':
      if (session.state !== 'CAPTURING') return invalid(session.state, event.type);
      return ok({ ...session, photos: event.photos, state: 'SELECTING_TEMPLATE' });
    case 'SELECT_TEMPLATE':
      if (session.state !== 'SELECTING_TEMPLATE') return invalid(session.state, event.type);
      return ok({ ...session, selectedTemplateId: event.templateId, state: event.allowsCustomization ? 'CUSTOMIZING' : 'COMPOSING' });
    case 'SAVE_CUSTOMIZATION':
      if (session.state !== 'CUSTOMIZING') return invalid(session.state, event.type);
      return ok({ ...session, state: 'COMPOSING' });
    case 'START_COMPOSITION':
      if (session.state !== 'COMPOSING') return invalid(session.state, event.type);
      return ok(session);
    case 'COMPOSITION_COMPLETE':
      if (session.state !== 'COMPOSING') return invalid(session.state, event.type);
      return ok({ ...session, outputs: event.outputs, state: 'RESULT_READY' });
    case 'COMPLETE_SESSION':
      if (session.state !== 'RESULT_READY') return invalid(session.state, event.type);
      return ok({ ...session, state: 'COMPLETED' });
    case 'RESET_GUEST':
      return ok({ sessionId: '', eventId: '', state: 'RESETTING', photos: [] });
    case 'FAIL':
      return ok({ ...session, state: 'ERROR', lastError: event.error });
  }
}

function ok(value: GuestSessionModel): Result<GuestSessionModel> {
  return { ok: true, value };
}

function invalid(state: GuestSessionState, eventType: GuestSessionEvent['type']): Result<GuestSessionModel> {
  return {
    ok: false,
    error: {
      code: 'INVALID_SESSION_TRANSITION',
      domain: 'platform',
      severity: 'warning',
      technicalMessage: `Cannot apply ${eventType} while session is ${state}.`,
      guestMessage: 'Hệ thống đang xử lý phiên chụp. Vui lòng thử lại sau.',
      recoverable: true,
    },
  };
}
