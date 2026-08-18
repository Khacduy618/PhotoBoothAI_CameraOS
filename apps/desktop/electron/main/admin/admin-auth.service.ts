import type { AdminSessionToken } from '@momentai/admin-contract';
import type { Result } from '@momentai/shared-types';

const DEFAULT_ADMIN_PASSCODE = '0000';
const TOKEN_TTL_MS = 8 * 60 * 60 * 1000;

export class WindowMiniAdminAuthService {
  private readonly activeTokens = new Map<string, number>();

  async unlock(passcode: string): Promise<Result<AdminSessionToken>> {
    const expected = process.env.MOMENTAI_ADMIN_PASSCODE || DEFAULT_ADMIN_PASSCODE;
    if (passcode !== expected) {
      return {
        ok: false,
        error: {
          code: 'ADMIN_PASSCODE_INVALID',
          domain: 'admin',
          severity: 'warning',
          technicalMessage: 'Invalid admin passcode.',
          guestMessage: 'Mã admin không đúng.',
          recoverable: true,
        },
      };
    }

    const token = `admin_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const expiresAtMs = Date.now() + TOKEN_TTL_MS;
    this.activeTokens.set(token, expiresAtMs);
    return { ok: true, value: { token, expiresAt: new Date(expiresAtMs).toISOString() } };
  }

  async lock(token: string): Promise<Result<void>> {
    this.activeTokens.delete(token);
    return { ok: true, value: undefined };
  }

  async verify(token: string): Promise<Result<void>> {
    const expiresAt = this.activeTokens.get(token);
    if (!expiresAt || expiresAt <= Date.now()) {
      if (expiresAt) this.activeTokens.delete(token);
      return {
        ok: false,
        error: {
          code: 'ADMIN_SESSION_LOCKED',
          domain: 'admin',
          severity: 'warning',
          technicalMessage: 'Admin session is missing or expired.',
          guestMessage: 'Phiên admin đã khoá hoặc hết hạn.',
          recoverable: true,
        },
      };
    }
    return { ok: true, value: undefined };
  }
}
