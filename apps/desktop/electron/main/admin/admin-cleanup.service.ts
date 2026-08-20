import type { MediaCleanupResult, MediaCleanupSessionSnapshot, MediaCleanupSummary } from '@momentai/storage-contract';
import type { Result } from '@momentai/shared-types';

import { windowMiniMediaRetentionService } from '../storage/media-retention.service';

export class WindowMiniAdminCleanupService {
  async summary(): Promise<Result<MediaCleanupSummary>> {
    return { ok: true, value: windowMiniMediaRetentionService.getSummary() };
  }

  async runNow(sessions: readonly MediaCleanupSessionSnapshot[] = []): Promise<Result<MediaCleanupResult[]>> {
    return windowMiniMediaRetentionService.runEligibleCleanup(sessions);
  }
}
