import {
  addMomentAIGuestPhoto,
  completeMomentAIGuestSession,
  composeMomentAIOutputs,
  requestMomentAIPrint,
  getMomentAIGuestSession,
  listMomentAICaptureFormats,
  listMomentAITemplates,
  saveMomentAICustomization,
  selectMomentAICaptureFormat,
  selectMomentAITemplate,
  startMomentAIGuestSession,
  getMomentAIReadiness,
} from '@/services/momentai-guest-session/momentai-guest-session-orchestrator.service';
import type { MomentAICaptureFormatId, MomentAICustomization, MomentAIGuestPhoto } from '@/types/momentai-guest-session';
import type { Result } from '@momentai/shared-types';

export class WindowMiniGuestSessionMainService {
  async getReadiness(): Promise<Result<unknown>> {
    return safe(() => getMomentAIReadiness());
  }

  async startSession(eventId?: string): Promise<Result<unknown>> {
    return safe(() => startMomentAIGuestSession(eventId));
  }

  async getSession(sessionId: string): Promise<Result<unknown>> {
    return safe(() => getMomentAIGuestSession(sessionId));
  }

  async listCaptureFormats(): Promise<Result<unknown>> {
    return safe(() => listMomentAICaptureFormats());
  }

  async selectFormat(sessionId: string, formatId: MomentAICaptureFormatId): Promise<Result<unknown>> {
    return safe(() => selectMomentAICaptureFormat(sessionId, formatId));
  }

  async addPhoto(sessionId: string, photo: Omit<MomentAIGuestPhoto, 'sessionId' | 'status' | 'capturedAt'>): Promise<Result<unknown>> {
    return safe(() => addMomentAIGuestPhoto(sessionId, photo));
  }

  async listTemplates(eventId: string, captureFormatId: MomentAICaptureFormatId): Promise<Result<unknown>> {
    return safe(() => listMomentAITemplates(eventId, captureFormatId));
  }

  async selectTemplate(sessionId: string, templateId: string): Promise<Result<unknown>> {
    return safe(() => selectMomentAITemplate(sessionId, templateId));
  }

  async saveCustomization(sessionId: string, customization: MomentAICustomization): Promise<Result<unknown>> {
    return safe(() => saveMomentAICustomization(sessionId, customization));
  }

  async compose(sessionId: string): Promise<Result<unknown>> {
    return safe(() => composeMomentAIOutputs(sessionId));
  }

  async requestPrint(sessionId: string, copies: number): Promise<Result<unknown>> {
    return safe(() => requestMomentAIPrint(sessionId, copies));
  }

  async complete(sessionId: string): Promise<Result<unknown>> {
    return safe(() => completeMomentAIGuestSession(sessionId));
  }
}

function safe<T>(fn: () => T): Result<T> {
  try {
    return { ok: true, value: fn() };
  } catch (cause) {
    return {
      ok: false,
      error: {
        code: 'GUEST_SESSION_MAIN_ERROR',
        domain: 'platform',
        severity: 'warning',
        technicalMessage: cause instanceof Error ? cause.message : 'Guest session main service failed.',
        guestMessage: 'Phiên chụp đang cần hỗ trợ.',
        recoverable: true,
      },
    };
  }
}

export const windowMiniGuestSessionMainService = new WindowMiniGuestSessionMainService();
