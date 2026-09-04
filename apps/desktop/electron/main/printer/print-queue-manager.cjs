/**
 * print-queue-manager.cjs
 *
 * Production Print Queue Manager for MomentAI CameraOS.
 * Target Hardware: Canon SELPHY CP1000 on Windows 10 x64.
 *
 * Provides:
 *  1. SQLite persistence with non-destructive schema migration
 *  2. Safe crash recovery (stale PRINTING / SUBMITTING jobs -> REQUIRES_REVIEW)
 *  3. Strengthened SHA-256 content-hash idempotency
 *  4. Immutable print master storage (outputs/print/print_<jobId>.jpg)
 *  5. Bounded retries and structured observability
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WindowsPrinterAdapter } = require('./windows-printer-adapter.cjs');

const CANON_CP1000_PROFILE = Object.freeze({
  id: 'CANON_SELPHY_CP1000',
  name: 'Canon SELPHY CP1000',
  mediaId: 'POSTCARD',
  widthMm: 100,
  heightMm: 148,
  dpi: 300,
  portrait: { widthPx: 1181, heightPx: 1748 },
  landscape: { widthPx: 1748, heightPx: 1181 },
  colorSpace: 'sRGB',
  outputMimeType: 'image/jpeg',
  jpegQuality: 0.95,
});

const PRINTER_PROFILES = {
  CANON_SELPHY_CP1000: CANON_CP1000_PROFILE,
};

function nowIso() {
  return new Date().toISOString();
}

class PrintQueueManager {
  constructor(options = {}) {
    this.queue = [];
    this.isProcessing = false;
    this.isPaused = false;
    this.ensureStorageDb = options.ensureStorageDb || (() => null);
    this.storageRoot = options.storageRoot || process.cwd();
    this.sessionMediaPaths = options.sessionMediaPaths || null;
    this.sessions = options.sessions || new Map();
    this.writeSystemLog = options.writeSystemLog || ((_lvl, _cat, _msg, _meta) => {});
    this.checkAndCompleteSession = options.checkAndCompleteSession || (() => {});
    this.adapter = options.adapter || new WindowsPrinterAdapter({ writeLog: options.writeLog });
  }

  init() {
    try {
      const db = this.ensureStorageDb();
      if (!db) return;

      // 1. Create base table if not exists
      db.exec(`
        CREATE TABLE IF NOT EXISTS print_jobs (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          print_master_path TEXT NOT NULL,
          paper_id TEXT NOT NULL,
          copies INTEGER NOT NULL DEFAULT 1,
          status TEXT NOT NULL,
          idempotency_key TEXT,
          attempt_count INTEGER NOT NULL DEFAULT 0,
          last_error TEXT,
          created_at TEXT NOT NULL,
          started_at TEXT,
          completed_at TEXT,
          updated_at TEXT NOT NULL,
          printer_profile_id TEXT,
          orientation TEXT,
          width_px INTEGER,
          height_px INTEGER,
          content_hash TEXT
        );

        CREATE TABLE IF NOT EXISTS printer_consumables (
          id TEXT PRIMARY KEY,
          total_capacity INTEGER NOT NULL DEFAULT 18,
          sheets_printed INTEGER NOT NULL DEFAULT 0,
          sheets_remaining INTEGER NOT NULL DEFAULT 18,
          is_paused INTEGER NOT NULL DEFAULT 0,
          last_reset_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);

      const consumable = db.prepare("SELECT * FROM printer_consumables WHERE id = 'default'").get();
      if (!consumable) {
        const now = nowIso();
        db.prepare(`
          INSERT INTO printer_consumables (id, total_capacity, sheets_printed, sheets_remaining, is_paused, last_reset_at, updated_at)
          VALUES ('default', 18, 0, 18, 0, ?, ?)
        `).run(now, now);
      } else {
        this.isPaused = Boolean(consumable.is_paused);
      }

      // 2. Non-destructive migration for existing databases
      const existingColumns = db.prepare('PRAGMA table_info(print_jobs)').all().map((c) => c.name);
      const requiredColumns = [
        { name: 'printer_profile_id', type: 'TEXT' },
        { name: 'orientation', type: 'TEXT' },
        { name: 'width_px', type: 'INTEGER' },
        { name: 'height_px', type: 'INTEGER' },
        { name: 'content_hash', type: 'TEXT' },
      ];

      for (const col of requiredColumns) {
        if (!existingColumns.includes(col.name)) {
          db.exec(`ALTER TABLE print_jobs ADD COLUMN ${col.name} ${col.type};`);
        }
      }

      // 3. Crash Recovery: Safe handling of in-flight jobs
      const rows = db.prepare("SELECT * FROM print_jobs WHERE status IN ('QUEUED', 'PREPARING', 'SUBMITTING', 'PRINTING') ORDER BY created_at ASC").all();
      for (const row of rows) {
        if (row.status === 'PRINTING' || row.status === 'SUBMITTING') {
          const now = nowIso();
          // To prevent double-printing on physical dye-sub printers, mark ambiguous in-flight jobs as REQUIRES_REVIEW
          db.prepare("UPDATE print_jobs SET status = 'REQUIRES_REVIEW', updated_at = ? WHERE id = ?").run(now, row.id);
          this.writeSystemLog('warn', 'PRINT:RECOVER', `In-flight job ${row.id} found on startup -> transitioned to REQUIRES_REVIEW to avoid accidental double-print.`, {
            jobId: row.id,
            sessionId: row.session_id,
            previousStatus: row.status,
          });
        } else if (row.status === 'QUEUED') {
          this.queue.push(row.id);
        }
      }

      if (this.queue.length > 0) {
        this.writeSystemLog('info', 'PRINT:QUEUE', `Recovered ${this.queue.length} pending queued print job(s) from SQLite.`, {
          pendingCount: this.queue.length,
        });
        if (!this.isPaused) {
          void this.processNext();
        }
      }
    } catch (err) {
      console.warn('[PrintQueueManager] Init error:', err);
    }
  }

  getConsumables() {
    try {
      const db = this.ensureStorageDb();
      if (!db) return { totalCapacity: 18, sheetsPrinted: 0, sheetsRemaining: 18, isLowPaper: false, isPaused: this.isPaused };
      const row = db.prepare("SELECT * FROM printer_consumables WHERE id = 'default'").get();
      if (!row) return { totalCapacity: 18, sheetsPrinted: 0, sheetsRemaining: 18, isLowPaper: false, isPaused: this.isPaused };
      return {
        totalCapacity: row.total_capacity,
        sheetsPrinted: row.sheets_printed,
        sheetsRemaining: row.sheets_remaining,
        isLowPaper: row.sheets_remaining <= 3,
        isPaused: Boolean(row.is_paused),
        lastResetAt: row.last_reset_at,
      };
    } catch {
      return { totalCapacity: 18, sheetsPrinted: 0, sheetsRemaining: 18, isLowPaper: false, isPaused: this.isPaused };
    }
  }

  resetConsumables(capacity = 18) {
    try {
      const db = this.ensureStorageDb();
      if (!db) return false;
      const now = nowIso();
      const cap = Number(capacity) || 18;
      db.prepare(`
        INSERT OR REPLACE INTO printer_consumables (id, total_capacity, sheets_printed, sheets_remaining, is_paused, last_reset_at, updated_at)
        VALUES ('default', ?, 0, ?, ?, ?, ?)
      `).run(cap, cap, this.isPaused ? 1 : 0, now, now);
      this.writeSystemLog('info', 'PRINT:CONSUMABLE', `Paper tray reset to full capacity (${cap} sheets).`, { capacity: cap });
      return true;
    } catch (e) {
      console.warn('[PrintQueueManager] Reset consumables error:', e);
      return false;
    }
  }

  pauseQueue() {
    this.isPaused = true;
    try {
      const db = this.ensureStorageDb();
      if (db) {
        db.prepare("UPDATE printer_consumables SET is_paused = 1, updated_at = ? WHERE id = 'default'").run(nowIso());
      }
    } catch {}
    this.writeSystemLog('warn', 'PRINT:QUEUE', 'Print queue PAUSED by operator.');
    return true;
  }

  resumeQueue() {
    this.isPaused = false;
    try {
      const db = this.ensureStorageDb();
      if (db) {
        db.prepare("UPDATE printer_consumables SET is_paused = 0, updated_at = ? WHERE id = 'default'").run(nowIso());
      }
    } catch {}
    this.writeSystemLog('info', 'PRINT:QUEUE', 'Print queue RESUMED by operator.');
    void this.processNext();
    return true;
  }

  retryJob(jobId) {
    try {
      const db = this.ensureStorageDb();
      if (!db) return { ok: false, error: 'DB not ready' };
      const row = db.prepare('SELECT * FROM print_jobs WHERE id = ?').get(jobId);
      if (!row) return { ok: false, error: 'Job not found' };
      const now = nowIso();
      db.prepare("UPDATE print_jobs SET status = 'QUEUED', attempt_count = 0, last_error = null, updated_at = ? WHERE id = ?").run(now, jobId);
      if (!this.queue.includes(jobId)) {
        this.queue.push(jobId);
      }
      this.writeSystemLog('info', 'PRINT:QUEUE', `Job ${jobId} re-enqueued for retry.`, { jobId });
      if (!this.isPaused) {
        void this.processNext();
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  cancelJob(jobId) {
    try {
      const db = this.ensureStorageDb();
      if (!db) return { ok: false, error: 'DB not ready' };
      const now = nowIso();
      db.prepare("UPDATE print_jobs SET status = 'CANCELLED', updated_at = ? WHERE id = ?").run(now, jobId);
      this.queue = this.queue.filter((id) => id !== jobId);
      this.writeSystemLog('warn', 'PRINT:QUEUE', `Job ${jobId} CANCELLED.`, { jobId });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  getQueueStatus() {
    try {
      const db = this.ensureStorageDb();
      const consumables = this.getConsumables();
      if (!db) {
        return {
          queueLength: this.queue.length,
          isProcessing: this.isProcessing,
          isPaused: this.isPaused,
          activeJob: null,
          recentJobs: [],
          consumables,
        };
      }

      const activeJob = db.prepare("SELECT * FROM print_jobs WHERE status = 'PRINTING' ORDER BY started_at DESC LIMIT 1").get() || null;
      const recentJobs = db.prepare("SELECT * FROM print_jobs ORDER BY created_at DESC LIMIT 15").all() || [];

      return {
        queueLength: this.queue.length,
        isProcessing: this.isProcessing,
        isPaused: this.isPaused,
        activeJob,
        recentJobs,
        consumables,
      };
    } catch (e) {
      return {
        queueLength: this.queue.length,
        isProcessing: this.isProcessing,
        isPaused: this.isPaused,
        activeJob: null,
        recentJobs: [],
        consumables: this.getConsumables(),
      };
    }
  }

  enqueue(session, options = {}) {
    const db = this.ensureStorageDb();
    if (!db) throw new Error('Storage database not initialized.');

    const sessionId = session.sessionId;
    const copies = Math.max(1, Number(options.copies) || 1); // Physical sheet copies
    const paperId = options.paperId || session.selectedTemplate?.printProfile?.paper || 'POSTCARD';
    const profileId = options.printerProfileId || 'CANON_SELPHY_CP1000';
    const profile = PRINTER_PROFILES[profileId] || CANON_CP1000_PROFILE;
    const orientation = options.orientation || (session.selectedFrame?.orientation === 'landscape' ? 'landscape' : 'portrait');
    const isLandscape = orientation === 'landscape';
    const widthPx = Number(options.widthPx) || (isLandscape ? profile.landscape.widthPx : profile.portrait.widthPx);
    const heightPx = Number(options.heightPx) || (isLandscape ? profile.landscape.heightPx : profile.portrait.heightPx);

    // 1. Resolve source print master file (NEVER fall back to digital final-image.jpg)
    const sourceMasterPath =
      options.printMasterPath ||
      session.outputs?.print ||
      (this.sessionMediaPaths ? this.sessionMediaPaths.printMaster(sessionId, 'cp1000') : null) ||
      path.join(this.storageRoot, 'sessions', sessionId, 'outputs', 'print-cp1000.jpg');

    if (!fs.existsSync(sourceMasterPath)) {
      const errMsg = `[PrintQueueManager] Physical print master not found at "${sourceMasterPath}". Refusing to fall back to digital final-image.jpg.`;
      this.writeSystemLog('error', 'PRINT:ERROR', errMsg, { sessionId, sourceMasterPath });
      console.warn(errMsg);
      return {
        ok: false,
        error: {
          code: 'PRINT_MASTER_NOT_FOUND',
          message: errMsg,
        },
      };
    }

    // 2. Compute content hash for idempotency and immutability
    const fileBytes = fs.readFileSync(sourceMasterPath);
    const fullContentHash = crypto.createHash('sha256').update(fileBytes).digest('hex');
    const contentHash = fullContentHash.substring(0, 16);

    // 3. Strengthened Idempotency Key
    const templateId = session.selectedTemplate?.templateId || session.product?.id || 'default';
    const idempotencyKey =
      options.idempotencyKey ||
      `print_${sessionId}_${templateId}_${copies}_${contentHash}_${profileId}`;

    const existing = db.prepare('SELECT * FROM print_jobs WHERE idempotency_key = ?').get(idempotencyKey);
    if (existing) {
      this.writeSystemLog('info', 'PRINT:IDEMPOTENT', `Idempotent print request matched existing job ${existing.id}`, {
        jobId: existing.id,
        sessionId,
        status: existing.status,
      });
      return { ok: true, value: existing, idempotent: true };
    }

    // 4. Create immutable job print master path
    const now = nowIso();
    const jobId = `print_${sessionId}_${Date.now().toString(36)}`;
    const printOutputsDir = this.sessionMediaPaths
      ? this.sessionMediaPaths.printDir(sessionId)
      : path.join(this.storageRoot, 'sessions', sessionId, 'outputs', 'print');
    fs.mkdirSync(printOutputsDir, { recursive: true });

    const immutableMasterPath = path.join(printOutputsDir, `print_${jobId}.jpg`);
    fs.copyFileSync(sourceMasterPath, immutableMasterPath);

    // Verify SHA-256 integrity of immutable copy
    const copyBytes = fs.readFileSync(immutableMasterPath);
    const copyHash = crypto.createHash('sha256').update(copyBytes).digest('hex');
    if (copyHash !== fullContentHash) {
      throw new Error(`[PrintQueueManager] Immutable print master copy hash mismatch: ${copyHash} !== ${fullContentHash}`);
    }

    const finalMasterPath = immutableMasterPath;

    const job = {
      id: jobId,
      sessionId,
      printMasterPath: finalMasterPath,
      paperId,
      copies,
      status: 'QUEUED',
      idempotencyKey,
      attemptCount: 0,
      lastError: null,
      createdAt: now,
      startedAt: null,
      completedAt: null,
      updatedAt: now,
      printerProfileId: profileId,
      orientation,
      widthPx,
      heightPx,
      contentHash,
    };

    db.prepare(`
      INSERT INTO print_jobs (
        id, session_id, print_master_path, paper_id, copies, status, idempotency_key, attempt_count,
        last_error, created_at, started_at, completed_at, updated_at, printer_profile_id, orientation,
        width_px, height_px, content_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      job.id, job.sessionId, job.printMasterPath, job.paperId, job.copies, job.status, job.idempotencyKey,
      job.attemptCount, job.lastError, job.createdAt, job.startedAt, job.completedAt, job.updatedAt,
      job.printerProfileId, job.orientation, job.widthPx, job.heightPx, job.contentHash
    );

    session.printJob = job;
    session.printStatus = 'QUEUED';
    this.sessions.set(sessionId, session);

    console.log(
      `[PRINT_JOB_PREPARED]\njobId=${job.id}\nmasterPath=${job.printMasterPath}\nwidth=${job.widthPx}\nheight=${job.heightPx}\ncopies=${job.copies}`,
    );

    console.log(
      `[PRINT_QUEUE_ENQUEUE]\njobId=${job.id}\nsessionId=${job.sessionId}\npaperId=${job.paperId}\ncopies=${job.copies}\nidempotencyKey=${job.idempotencyKey}\nprintMasterPath=${job.printMasterPath}`,
    );

    this.writeSystemLog('info', 'PRINT:QUEUE', `Print job ${job.id} durably enqueued into SQLite.`, {
      jobId: job.id,
      sessionId: session.sessionId,
      copies: job.copies,
      status: 'QUEUED',
    });

    this.queue.push(job.id);
    void this.processNext();

    return { ok: true, value: job, idempotent: false };
  }

  async processNext() {
    if (this.isProcessing || this.isPaused || this.queue.length === 0) return;
    this.isProcessing = true;

    const jobId = this.queue.shift();
    if (!jobId) {
      this.isProcessing = false;
      return;
    }

    try {
      const db = this.ensureStorageDb();
      if (!db) {
        this.isProcessing = false;
        return;
      }

      const jobRow = db.prepare('SELECT * FROM print_jobs WHERE id = ?').get(jobId);
      if (!jobRow || jobRow.status !== 'QUEUED') {
        this.isProcessing = false;
        void this.processNext();
        return;
      }

      const now = nowIso();
      db.prepare("UPDATE print_jobs SET status = 'PRINTING', started_at = ?, updated_at = ? WHERE id = ?").run(now, now, jobId);

      const memSession = this.sessions.get(jobRow.session_id);
      if (memSession) {
        memSession.printStatus = 'PRINTING';
        if (memSession.printJob) memSession.printJob.status = 'PRINTING';
      }

      this.writeSystemLog('info', 'PRINT:WORKER', `Starting print worker execution for Job ${jobId}`, {
        jobId,
        sessionId: jobRow.session_id,
        status: 'PRINTING',
      });

      const printResult = await this.adapter.print(jobRow);

      if (printResult.ok) {
        const completedNow = nowIso();
        db.prepare("UPDATE print_jobs SET status = 'COMPLETED', completed_at = ?, updated_at = ? WHERE id = ?").run(completedNow, completedNow, jobId);

        // Update Consumables (sheets printed & remaining)
        try {
          const copies = Number(jobRow.copies) || 1;
          db.prepare(`
            UPDATE printer_consumables
            SET sheets_printed = sheets_printed + ?,
                sheets_remaining = MAX(0, sheets_remaining - ?),
                updated_at = ?
            WHERE id = 'default'
          `).run(copies, copies, completedNow);
        } catch (e) {
          console.warn('[PrintQueueManager] Consumable update error:', e.message);
        }

        if (memSession) {
          memSession.printStatus = 'COMPLETED';
          if (memSession.printJob) {
            memSession.printJob.status = 'COMPLETED';
            memSession.printJob.completedAt = completedNow;
          }
        }

        this.writeSystemLog('info', 'PRINT:WORKER', `Print Job ${jobId} COMPLETED successfully.`, {
          jobId,
          sessionId: jobRow.session_id,
          status: 'COMPLETED',
        });

        this.checkAndCompleteSession(jobRow.session_id);
      } else {
        const nextAttempts = (jobRow.attempt_count || 0) + 1;
        const errNow = nowIso();
        const errMsg = printResult.error?.message || 'Printer error';

        if (nextAttempts < 2) {
          db.prepare("UPDATE print_jobs SET status = 'QUEUED', attempt_count = ?, last_error = ?, updated_at = ? WHERE id = ?").run(nextAttempts, errMsg, errNow, jobId);
          this.writeSystemLog('warn', 'PRINT:WORKER', `Print Job ${jobId} failed attempt ${nextAttempts}. Retrying in 2s...`, {
            jobId,
            sessionId: jobRow.session_id,
            error: errMsg,
          });
          setTimeout(() => {
            this.queue.push(jobId);
            if (!this.isPaused) {
              void this.processNext();
            }
          }, 2000);
        } else {
          db.prepare("UPDATE print_jobs SET status = 'FAILED', attempt_count = ?, last_error = ?, updated_at = ? WHERE id = ?").run(nextAttempts, errMsg, errNow, jobId);
          if (memSession) {
            memSession.printStatus = 'FAILED';
            if (memSession.printJob) memSession.printJob.status = 'FAILED';
          }
          this.writeSystemLog('error', 'PRINT:WORKER', `Print Job ${jobId} FAILED after ${nextAttempts} attempts.`, {
            jobId,
            sessionId: jobRow.session_id,
            status: 'FAILED',
            error: errMsg,
          });
        }
      }
    } catch (err) {
      console.warn('[PrintQueueManager] Worker execution error:', err);
    } finally {
      this.isProcessing = false;
      if (!this.isPaused) {
        setTimeout(() => void this.processNext(), 100);
      }
    }
  }
}

module.exports = { PrintQueueManager };
