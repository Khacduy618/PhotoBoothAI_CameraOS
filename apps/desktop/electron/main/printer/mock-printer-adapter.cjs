/**
 * mock-printer-adapter.cjs
 *
 * Mock Printer Adapter for development and automated testing environments.
 * Simulates physical print timing and status transitions.
 */

class MockPrinterAdapter {
  constructor(options = {}) {
    this.name = 'MockPrinterAdapter';
    this.provider = 'fake';
    this.delayMs = typeof options.delayMs === 'number' ? options.delayMs : 1500;
    this.shouldFail = Boolean(options.shouldFail);
    this.failureMessage = options.failureMessage || 'Mock printer failure';
    this.writeLog = options.writeLog || console.log;
  }

  async print(job) {
    const jobId = job.id;
    const sessionId = job.session_id || job.sessionId;
    const copies = job.copies || 1;
    const paperId = job.paper_id || job.paperId || 'POSTCARD';
    const profileId = job.printer_profile_id || job.printerProfileId || 'CANON_SELPHY_CP1000';

    if (this.writeLog) {
      this.writeLog(`[PRINT_SPOOL_SUBMIT_BEGIN]\njobId=${jobId}`);
      this.writeLog(
        `[PRINT_SUBMIT_BEGIN]\njobId=${jobId}\nsessionId=${sessionId}\nprovider=mock-printer\nprinterProfile=${profileId}\npaperId=${paperId}\ncopies=${copies}\nmasterPath=${job.print_master_path || job.printMasterPath}`,
      );
    }

    if (this.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    }

    if (this.shouldFail) {
      if (this.writeLog) {
        this.writeLog(
          `[PRINT_PRINTER_ERROR]\njobId=${jobId}\ncode=PRINTER_SUBMISSION_FAILED\nmessage=${this.failureMessage}`,
        );
        this.writeLog(
          `[PRINT_SUBMIT_FAILED]\njobId=${jobId}\nsessionId=${sessionId}\nerror=${this.failureMessage}`,
        );
      }
      return {
        ok: false,
        error: {
          code: 'PRINTER_SUBMISSION_FAILED',
          message: this.failureMessage,
        },
      };
    }

    const spoolJobId = `mock_spool_${Date.now().toString(36)}`;
    if (this.writeLog) {
      this.writeLog(
        `[PRINT_SPOOL_SUBMITTED]\njobId=${jobId}\nwindowsSpoolJobId=${spoolJobId}`,
      );
      this.writeLog(
        `[PRINT_SPOOL_STATUS]\njobId=${jobId}\nspoolJobId=${spoolJobId}\nstatus=PRINTING`,
      );
      this.writeLog(
        `[PRINT_SPOOL_COMPLETE]\njobId=${jobId}\nspoolJobId=${spoolJobId}`,
      );
      this.writeLog(
        `[PRINT_SUBMIT_COMPLETE]\njobId=${jobId}\nsessionId=${sessionId}\nstatus=COMPLETED`,
      );
    }

    return {
      ok: true,
      value: {
        jobId,
        status: 'COMPLETED',
      },
    };
  }
}

module.exports = { MockPrinterAdapter };
