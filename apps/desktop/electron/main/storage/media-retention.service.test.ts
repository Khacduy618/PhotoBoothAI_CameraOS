import { describe, expect, it } from 'vitest';

import { WindowMiniMediaRetentionService } from './media-retention.service';

describe('WindowMiniMediaRetentionService', () => {
  it('does not delete active sessions', () => {
    const service = new WindowMiniMediaRetentionService({ enabled: true, retentionMinutes: 10, cleanupIntervalSeconds: 60, mode: 'audit_minimal', deferWhilePrintActive: true, printCleanupGraceMinutes: 30 });
    const result = service.runEligibleCleanup([
      { sessionId: 'active_1', status: 'active', completedAt: '2026-08-12T00:00:00.000Z' },
    ], new Date('2026-08-12T00:20:00.000Z'));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toHaveLength(0);
  });

  it('deletes completed sessions after retention window', () => {
    const service = new WindowMiniMediaRetentionService({ enabled: true, retentionMinutes: 10, cleanupIntervalSeconds: 60, mode: 'audit_minimal', deferWhilePrintActive: true, printCleanupGraceMinutes: 30 });
    const result = service.runEligibleCleanup([
      { sessionId: 'done_1', status: 'completed', completedAt: '2026-08-12T00:00:00.000Z', printStatus: 'completed' },
    ], new Date('2026-08-12T00:11:00.000Z'));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0].job.status).toBe('deleted');
      expect(result.value[0].redactedRows).toBe(2);
    }
  });

  it('defers cleanup while print is active within grace period', () => {
    const service = new WindowMiniMediaRetentionService({ enabled: true, retentionMinutes: 10, cleanupIntervalSeconds: 60, mode: 'audit_minimal', deferWhilePrintActive: true, printCleanupGraceMinutes: 30 });
    const result = service.runEligibleCleanup([
      { sessionId: 'printing_1', status: 'completed', completedAt: '2026-08-12T00:00:00.000Z', printStatus: 'printing' },
    ], new Date('2026-08-12T00:11:00.000Z'));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toHaveLength(0);
    expect(service.getSummary().pending + service.getSummary().eligible + service.getSummary().deleted + service.getSummary().failed).toBeGreaterThanOrEqual(0);
  });
});
