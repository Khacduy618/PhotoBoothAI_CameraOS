import { describe, expect, it } from 'vitest';

import { createDefaultV1EventConfig } from './index';

describe('createDefaultV1EventConfig', () => {
  it('captures Sprint 1 production runtime and storage defaults', () => {
    const config = createDefaultV1EventConfig({ eventId: 'event_1', name: 'Hoi An Night' });

    expect(config.runtime).toEqual({
      platform: 'windows_exe',
      dataRoot: 'LOCALAPPDATA',
      kioskMode: 'FULLSCREEN_KIOSK',
      startupAutoLaunch: true,
    });
    expect(config.allowGuestRetake).toBe(false);
    expect(config.maxRetakesPerShot).toBe(0);
  });

  it('captures cloud QR TTL and cleanup policy defaults', () => {
    const config = createDefaultV1EventConfig({ eventId: 'event_2', name: 'Cloud QR Event' });

    expect(config.share.mode).toBe('CLOUD_LANDING_PAGE');
    expect(config.share.cloudProvider).toBe('VERCEL_NEON_R2');
    expect(config.share.qrTokenTtlMinutes).toBe(10);
    expect(config.share.cleanupAfterMinutes).toBe(30);
    expect(config.share.localFallbackEnabled).toBe(true);
  });

  it('keeps V1 print guest-confirmed with stop-on-fail manual recovery', () => {
    const config = createDefaultV1EventConfig({ eventId: 'event_3', name: 'Print Event' });

    expect(config.print.policy).toBe('GUEST_CONFIRM');
    expect(config.print.certifiedPrinterTarget).toBe('CANON_SELPHY_CP1000');
    expect(config.print.draftCopyPolicy).toEqual({
      premium: 2,
      sheet: 2,
      strip: 1,
      finalDesignApproved: false,
    });
    expect(config.print.queue).toMatchObject({
      failurePolicy: 'STOP_QUEUE_REQUIRE_MANUAL_REPRINT',
      autoRetry: false,
      stopOnFailure: true,
      manualReprintRequired: true,
    });
  });
});
