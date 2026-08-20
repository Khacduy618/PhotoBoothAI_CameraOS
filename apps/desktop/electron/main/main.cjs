const { app, BrowserWindow, ipcMain, screen } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');
const { CanonCameraBridgeManager } = require('./camera/canon-camera-bridge.cjs');

const canonBridge = new CanonCameraBridgeManager();

const isDev = !app.isPackaged;
const rendererUrl =
  process.env.WINDOWMINI_RENDERER_URL || 'http://localhost:5173';

const projectRoot = path.resolve(__dirname, '../../..');
const logDir = process.env.MOMENTAI_LOG_DIR || path.join(projectRoot, 'artifacts', 'logs');
const systemLogFile = path.join(logDir, 'momentai-cameraos.log');
const canonShadowLogFile = path.join(logDir, 'canon-shadow.log');
const storageRoot = path.resolve(process.env.MOMENTAI_STORAGE_DIR || path.join(projectRoot, 'artifacts', 'windowmini-storage'));
const storageDbFile = path.join(storageRoot, 'cameraos-storage.sqlite');
let storageDb = null;

function appendStructuredLog(filePath, line) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, `${JSON.stringify(line)}\n`, 'utf8');
}

function writeSystemLog(level, event, message, details = {}) {
  const line = { timestamp: new Date().toISOString(), level, event, message, ...details };
  appendStructuredLog(systemLogFile, line);
  return line;
}

function writeCanonShadowLog(command, details = {}) {
  const line = writeSystemLog('info', 'CANON:SHADOW', `Simulated Canon EOS 6D command: ${command}`, {
    provider: 'canon-shadow',
    preferredProvider: 'canon',
    activeProvider: 'mac-device-camera',
    simulated: true,
    command,
    ...details,
  });
  appendStructuredLog(canonShadowLogFile, line);
  return line;
}

function createWindow(mode = 'guest') {
  const displays = screen.getAllDisplays();
  const primaryDisplay = screen.getPrimaryDisplay();
  const secondaryDisplay = displays.find((display) => display.id !== primaryDisplay.id);

  const isGuest = mode === 'guest';
  const targetDisplay = (isGuest && secondaryDisplay) ? secondaryDisplay : primaryDisplay;

  const { x, y, width, height } = targetDisplay.bounds;

  console.log(`[DISPLAY_AUDIT] DISPLAY_COUNT = ${displays.length}`);
  console.log(`[DISPLAY_AUDIT] PRIMARY_DISPLAY = ${JSON.stringify(primaryDisplay.bounds)}`);
  console.log(`[DISPLAY_AUDIT] SECONDARY_DISPLAY = ${JSON.stringify(secondaryDisplay?.bounds || null)}`);
  console.log(`[DISPLAY_AUDIT] ELECTRON_DISPLAY = ${targetDisplay.id === primaryDisplay.id ? 'PRIMARY' : 'SECONDARY'}`);
  console.log(`[DISPLAY_AUDIT] ELECTRON_WINDOW_BOUNDS = ${JSON.stringify({ x, y, width, height })}`);

  const win = new BrowserWindow({
    x,
    y,
    width,
    height,
    frame: true,
    fullscreenable: true,
    autoHideMenuBar: isGuest,
    show: false,
    backgroundColor: isGuest ? '#FDFCFB' : '#111111',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const target = isDev
    ? `${rendererUrl}/#/${mode}`
    : `file://${path.join(
      __dirname,
      '../../renderer/dist/index.html'
    )}#/${mode}`;

  void win.loadURL(target);

  win.once('ready-to-show', () => {
    win.setBounds({ x, y, width, height });
    win.show();
    win.focus();
    console.log(`[DISPLAY_AUDIT] ELECTRON_GUEST_VISIBLE = YES (Bounds: ${JSON.stringify(win.getBounds())})`);
  });

  return win;
}

const captureFormats = [
  { id: 'format_1shot', label: '1 Shot', shotCount: 1, slotCount: 1, layoutType: 'single' },
  { id: 'format_2shot', label: '2 Shots', shotCount: 2, slotCount: 2, layoutType: 'vertical_2' },
  { id: 'format_4shot', label: '4 Shots', shotCount: 4, slotCount: 4, layoutType: 'vertical_4' },
  { id: 'format_6shot', label: '6 Shots', shotCount: 6, slotCount: 6, layoutType: '2col_3row' },
];

const activeEventConfig = {
  eventId: 'event_hoi_an_heritage',
  name: 'Phố Cổ Hội An',
  status: 'active',
  enabledShotFormats: ['format_1shot', 'format_2shot', 'format_4shot', 'format_6shot'],
  timeoutSeconds: 120,
  printPolicy: 'GUEST_CONFIRM',
  shareMode: 'LOCAL_NETWORK_URL',
  allowGuestRetake: false,
  maxRetakesPerShot: 0,
};

const healthSnapshot = {
  camera: 'ready',
  storage: 'ready',
  database: 'ready',
  composition: 'ready',
  printer: 'degraded',
  shareNetwork: 'degraded',
};

const sessions = new Map();
const adminEvents = new Map([['event_hoi_an_heritage', { eventId: 'event_hoi_an_heritage', name: 'Phố Cổ Hội An', status: 'active' }]]);
const adminTemplates = new Map();

function ok(value) {
  return { ok: true, value };
}

function unavailable(code) {
  return { ok: false, error: { code, domain: 'platform', severity: 'warning', technicalMessage: `${code} is not bound to production service yet.`, guestMessage: 'Tính năng desktop đang ở chế độ skeleton.', recoverable: true } };
}

function nowIso() {
  return new Date().toISOString();
}

function createGuestSession(eventId = 'event_hoi_an_heritage') {
  const now = nowIso();
  return {
    sessionId: `desktop_session_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
    eventId,
    captureFormat: null,
    photos: [],
    selectedTemplate: null,
    slotAssignments: [],
    customization: { text: [], drawing: [] },
    outputs: { master: null, share: null, print: null },
    qr: null,
    printJob: null,
    status: 'SELECTING_FORMAT',
    createdAt: now,
    updatedAt: now,
  };
}

function touch(session, status = session.status) {
  const now = nowIso();
  const isCompleted = status === 'COMPLETED' || session.status === 'COMPLETED';
  const updated = {
    ...session,
    status: isCompleted ? 'COMPLETED' : 'ACTIVE',
    internalStatus: status,
    lastActivityAt: now,
    completedAt: isCompleted ? (session.completedAt || now) : session.completedAt,
    updatedAt: now,
  };
  sessions.set(updated.sessionId, updated);
  return updated;
}

let cleanupIntervalId = null;

function scanAllSessionsForCleanup() {
  const snapshots = [];
  for (const session of sessions.values()) {
    snapshots.push({
      sessionId: session.sessionId,
      status: session.status || 'ACTIVE',
      createdAt: session.createdAt,
      lastActivityAt: session.lastActivityAt || session.updatedAt || session.createdAt,
      completedAt: session.completedAt,
      uploadState: session.uploadState || 'NONE',
      printStatus: session.printJob ? session.printJob.status : 'NONE',
      sessionPath: path.join(storageRoot, 'sessions', session.sessionId),
    });
  }
  try {
    const db = ensureStorageDb();
    const rows = db.prepare('SELECT session_id, created_at, updated_at, payload_json FROM sessions').all();
    for (const r of rows) {
      if (!sessions.has(r.session_id)) {
        let parsed = {};
        try {
          if (r.payload_json) parsed = JSON.parse(r.payload_json);
        } catch {}
        snapshots.push({
          sessionId: r.session_id,
          status: parsed.status || 'ABORTED',
          createdAt: r.created_at,
          lastActivityAt: r.updated_at || r.created_at,
          completedAt: parsed.completedAt,
          uploadState: parsed.uploadState || 'NONE',
          printStatus: parsed.printStatus || 'NONE',
          sessionPath: path.join(storageRoot, 'sessions', r.session_id),
        });
      }
    }
  } catch {}
  return snapshots;
}

function getEffectiveRetentionMs() {
  const envTtlMs = process.env.SESSION_CLEANUP_TTL_MS;
  if (envTtlMs && !Number.isNaN(Number(envTtlMs))) {
    const val = Number(envTtlMs);
    if (val > 0) return val;
  }
  const envMinutes = process.env.SESSION_RETENTION_MINUTES;
  if (envMinutes && !Number.isNaN(Number(envMinutes))) {
    const val = Number(envMinutes);
    if (val > 0) return val * 60 * 1000;
  }
  return 20 * 60 * 1000;
}

function performSessionCleanup() {
  try {
    const snapshots = scanAllSessionsForCleanup();
    const ttlMs = getEffectiveRetentionMs();
    const now = new Date();

    for (const s of snapshots) {
      const isCompleted = s.status === 'COMPLETED' || s.status === 'completed';
      const isActive = s.status === 'ACTIVE' || s.status === 'active';
      const refTime = s.completedAt || s.lastActivityAt || s.createdAt;
      const elapsed = refTime ? (now.getTime() - new Date(refTime).getTime()) : 0;

      if (isActive && elapsed < ttlMs) continue;
      if (['PENDING', 'UPLOADING', 'RETRYING'].includes(String(s.uploadState).toUpperCase())) continue;
      if (['QUEUED', 'PRINTING', 'RETRYING', 'VALIDATING'].includes(String(s.printStatus).toUpperCase())) continue;

      if (elapsed >= ttlMs) {
        const targetDir = s.sessionPath || path.join(storageRoot, 'sessions', s.sessionId);
        const resolvedSessionsRoot = path.resolve(path.join(storageRoot, 'sessions'));
        const resolvedTarget = path.resolve(targetDir);

        if (resolvedTarget.startsWith(resolvedSessionsRoot + path.sep) && fs.existsSync(resolvedTarget)) {
          try {
            fs.rmSync(resolvedTarget, { recursive: true, force: true });
            writeSystemLog('info', 'SESSION_CLEANUP', `Cleaned expired session ${s.sessionId}`, {
              sessionId: s.sessionId,
              ageMinutes: Math.floor(elapsed / 60000),
            });
          } catch (err) {
            console.warn('[SessionCleanup] Failed removing dir:', targetDir, err);
          }
        }

        try {
          const db = ensureStorageDb();
          db.prepare('DELETE FROM stored_files WHERE session_id = ?').run(s.sessionId);
          db.prepare('DELETE FROM sessions WHERE session_id = ?').run(s.sessionId);
        } catch {}

        sessions.delete(s.sessionId);
      }
    }
  } catch (err) {
    console.warn('[SessionCleanup] Error during cleanup:', err);
  }
}

function initSessionCleanupScheduler() {
  if (cleanupIntervalId) return;
  performSessionCleanup();
  cleanupIntervalId = setInterval(performSessionCleanup, 30 * 1000);
}

function isSessionWorkComplete(session) {
  if (!session) return false;
  if (session.printJob) {
    const pStatus = String(session.printJob.status || '').toUpperCase();
    if (pStatus !== 'COMPLETED' && pStatus !== 'CANCELLED' && pStatus !== 'FAILED') {
      return false;
    }
  }
  const uStatus = String(session.uploadState || 'NONE').toUpperCase();
  if (uStatus === 'PENDING' || uStatus === 'UPLOADING' || uStatus === 'RETRYING') {
    return false;
  }
  return true;
}

function checkAndCompleteSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return;
  if (isSessionWorkComplete(session)) {
    const now = nowIso();
    const ttlMs = getEffectiveRetentionMs();
    const cleanupAfter = new Date(Date.now() + ttlMs).toISOString();
    const updated = {
      ...session,
      status: 'COMPLETED',
      completedAt: session.completedAt || now,
      cleanupAfter,
      updatedAt: now,
    };
    sessions.set(sessionId, updated);
    try {
      const db = ensureStorageDb();
      db.prepare('INSERT INTO sessions (session_id, created_at, updated_at, payload_json) VALUES (?, ?, ?, ?) ON CONFLICT(session_id) DO UPDATE SET updated_at = excluded.updated_at, payload_json = excluded.payload_json').run(
        updated.sessionId,
        updated.createdAt,
        updated.updatedAt,
        JSON.stringify(updated)
      );
      writeSystemLog('info', 'SESSION:COMPLETE', `Session ${sessionId} background work satisfied. Marked COMPLETED.`, {
        sessionId,
        completedAt: updated.completedAt,
        cleanupAfter: updated.cleanupAfter,
      });
    } catch (err) {
      console.warn('Failed to update completed session in DB:', err);
    }
  }
}

class MockPrinterAdapter {
  constructor() {
    this.name = 'MockPrinterAdapter';
  }
  async print(job) {
    writeSystemLog('info', 'PRINT:MOCK', `[MOCK] Starting print execution for Job ${job.id}`, {
      provider: 'mock-printer',
      jobId: job.id,
      sessionId: job.session_id || job.sessionId,
      copies: job.copies,
      paperId: job.paper_id || job.paperId,
      status: 'PRINTING',
    });
    // Simulate 2s printing time
    await new Promise((resolve) => setTimeout(resolve, 2000));
    writeSystemLog('info', 'PRINT:MOCK', `[MOCK] Physical print completed successfully for Job ${job.id}`, {
      provider: 'mock-printer',
      jobId: job.id,
      sessionId: job.session_id || job.sessionId,
      status: 'COMPLETED',
    });
    return { ok: true, value: { jobId: job.id, status: 'COMPLETED' } };
  }
}

class PrintQueueManager {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.adapter = new MockPrinterAdapter();
  }

  init() {
    try {
      const db = ensureStorageDb();
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
          updated_at TEXT NOT NULL
        );
      `);

      const rows = db.prepare("SELECT * FROM print_jobs WHERE status IN ('QUEUED', 'PRINTING') ORDER BY created_at ASC").all();
      for (const row of rows) {
        if (row.status === 'PRINTING') {
          const now = nowIso();
          db.prepare("UPDATE print_jobs SET status = 'QUEUED', updated_at = ? WHERE id = ?").run(now, row.id);
          writeSystemLog('warn', 'PRINT:RECOVER', `Recovered stale PRINTING job ${row.id} -> reset to QUEUED`, {
            jobId: row.id,
            sessionId: row.session_id,
          });
        }
        this.queue.push(row.id);
      }
      if (this.queue.length > 0) {
        writeSystemLog('info', 'PRINT:QUEUE', `Recovered ${this.queue.length} pending print job(s) from SQLite storage.`, {
          pendingCount: this.queue.length,
        });
        void this.processNext();
      }
    } catch (err) {
      console.warn('[PrintQueue] Init error:', err);
    }
  }

  enqueue(session, options = {}) {
    const db = ensureStorageDb();
    const idempotencyKey = options.idempotencyKey || `${session.sessionId}_print_${session.selectedTemplate?.templateId || 'default'}`;

    const existing = db.prepare("SELECT * FROM print_jobs WHERE idempotency_key = ?").get(idempotencyKey);
    if (existing) {
      writeSystemLog('info', 'PRINT:IDEMPOTENT', `Idempotent print request matched existing job ${existing.id}`, {
        jobId: existing.id,
        sessionId: session.sessionId,
        status: existing.status,
      });
      return { ok: true, value: existing, idempotent: true };
    }

    const now = nowIso();
    const jobId = `print_${session.sessionId}_${Date.now().toString(36)}`;
    const printMasterPath = session.outputs?.print || session.outputs?.master || path.join(storageRoot, 'sessions', session.sessionId, 'outputs', 'final-print.jpg');
    const paperId = session.selectedTemplate?.printProfile?.paper || '4x6';
    const copies = Number(options.copies) || 1;

    const job = {
      id: jobId,
      sessionId: session.sessionId,
      printMasterPath,
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
    };

    db.prepare(`
      INSERT INTO print_jobs (
        id, session_id, print_master_path, paper_id, copies, status, idempotency_key, attempt_count, last_error, created_at, started_at, completed_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      job.id, job.sessionId, job.printMasterPath, job.paperId, job.copies, job.status,
      job.idempotencyKey, job.attemptCount, job.lastError, job.createdAt, job.startedAt, job.completedAt, job.updatedAt
    );

    session.printJob = job;
    session.printStatus = 'QUEUED';
    sessions.set(session.sessionId, session);

    writeSystemLog('info', 'PRINT:QUEUE', `Print job ${job.id} durably enqueued into SQLite.`, {
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
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;

    const jobId = this.queue.shift();
    if (!jobId) {
      this.isProcessing = false;
      return;
    }

    try {
      const db = ensureStorageDb();
      const jobRow = db.prepare("SELECT * FROM print_jobs WHERE id = ?").get(jobId);
      if (!jobRow || jobRow.status !== 'QUEUED') {
        this.isProcessing = false;
        void this.processNext();
        return;
      }

      const now = nowIso();
      db.prepare("UPDATE print_jobs SET status = 'PRINTING', started_at = ?, updated_at = ? WHERE id = ?").run(now, now, jobId);

      const memSession = sessions.get(jobRow.session_id);
      if (memSession) {
        memSession.printStatus = 'PRINTING';
        if (memSession.printJob) memSession.printJob.status = 'PRINTING';
      }

      writeSystemLog('info', 'PRINT:WORKER', `Starting print worker execution for Job ${jobId}`, {
        jobId,
        sessionId: jobRow.session_id,
        status: 'PRINTING',
      });

      const printResult = await this.adapter.print(jobRow);

      if (printResult.ok) {
        const completedNow = nowIso();
        db.prepare("UPDATE print_jobs SET status = 'COMPLETED', completed_at = ?, updated_at = ? WHERE id = ?").run(completedNow, completedNow, jobId);
        
        if (memSession) {
          memSession.printStatus = 'COMPLETED';
          if (memSession.printJob) {
            memSession.printJob.status = 'COMPLETED';
            memSession.printJob.completedAt = completedNow;
          }
        }

        writeSystemLog('info', 'PRINT:WORKER', `Print Job ${jobId} COMPLETED successfully.`, {
          jobId,
          sessionId: jobRow.session_id,
          status: 'COMPLETED',
        });

        checkAndCompleteSession(jobRow.session_id);
      } else {
        const nextAttempts = (jobRow.attempt_count || 0) + 1;
        const errNow = nowIso();
        const errMsg = printResult.error?.message || 'Printer error';

        if (nextAttempts < 2) {
          db.prepare("UPDATE print_jobs SET status = 'QUEUED', attempt_count = ?, last_error = ?, updated_at = ? WHERE id = ?").run(nextAttempts, errMsg, errNow, jobId);
          writeSystemLog('warn', 'PRINT:WORKER', `Print Job ${jobId} failed attempt ${nextAttempts}. Retrying in 2s...`, {
            jobId,
            sessionId: jobRow.session_id,
            error: errMsg,
          });
          setTimeout(() => {
            this.queue.push(jobId);
            void this.processNext();
          }, 2000);
        } else {
          db.prepare("UPDATE print_jobs SET status = 'FAILED', attempt_count = ?, last_error = ?, updated_at = ? WHERE id = ?").run(nextAttempts, errMsg, errNow, jobId);
          if (memSession) {
            memSession.printStatus = 'FAILED';
            if (memSession.printJob) memSession.printJob.status = 'FAILED';
          }
          writeSystemLog('error', 'PRINT:WORKER', `Print Job ${jobId} FAILED after ${nextAttempts} attempts.`, {
            jobId,
            sessionId: jobRow.session_id,
            status: 'FAILED',
            error: errMsg,
          });
        }
      }
    } catch (err) {
      console.warn('[PrintQueue] Worker execution error:', err);
    } finally {
      this.isProcessing = false;
      setTimeout(() => void this.processNext(), 100);
    }
  }
}

const printQueue = new PrintQueueManager();

function requireGuestSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) throw new Error('Session not found.');
  return session;
}

let adminDb = null;
function ensureAdminDb() {
  if (adminDb) return adminDb;
  const adminDataDir = path.resolve(process.cwd(), process.env.CAMERAOS_DATA_DIR || '.cameraos-data');
  fs.mkdirSync(adminDataDir, { recursive: true });
  const adminDbFile = path.join(adminDataDir, 'admin.sqlite');
  adminDb = new Database(adminDbFile);
  adminDb.pragma('journal_mode = WAL');
  adminDb.pragma('foreign_keys = OFF');

  adminDb.exec(`
    CREATE TABLE IF NOT EXISTS events (
      event_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'archived')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Auto-migrate legacy admin_events table if present
  try {
    const hasLegacyEvents = adminDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='admin_events'").get();
    if (hasLegacyEvents) {
      adminDb.exec(`
        INSERT OR IGNORE INTO events (event_id, name, status, created_at, updated_at)
        SELECT event_id, name, status, created_at, updated_at FROM admin_events;
      `);
    }
  } catch {}

  adminDb.exec(`
    CREATE TABLE IF NOT EXISTS admin_frames (
      frame_id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL DEFAULT 'event_hoi_an_heritage',
      definition_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'published' CHECK(status IN ('published', 'private')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(event_id) REFERENCES events(event_id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_admin_frames_event_status
      ON admin_frames(event_id, status, updated_at);
  `);

  // Auto-migrate legacy frame_definitions table if present
  try {
    const hasLegacyFrames = adminDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='frame_definitions'").get();
    if (hasLegacyFrames) {
      adminDb.exec(`
        INSERT OR IGNORE INTO admin_frames (frame_id, event_id, definition_json, status, created_at, updated_at)
        SELECT frame_id, event_id, definition_json, status, created_at, updated_at FROM frame_definitions;
      `);
    }
  } catch {}

  // Purge any legacy mock frames saved in SQLite during previous testing
  try {
    adminDb.exec(`
      DELETE FROM admin_frames WHERE frame_id LIKE '%1premium%' OR frame_id LIKE '%desktop_template%' OR definition_json LIKE '%PHỐ CỔ HỘI AN%';
    `);
  } catch {}

  const now = nowIso();
  const popularEvents = [
    { eventId: 'event_hoi_an_heritage', name: 'Hội An Di Sản • Heritage Photo Booth' },
    { eventId: 'event_tet_nguyen_dan', name: 'Tết Nguyên Đán • Xuân Bính Ngọ' },
    { eventId: 'event_dam_cuoi_viet', name: 'Lễ Thành Hôn • Tiệc Cưới Việt' },
    { eventId: 'event_trung_thu', name: 'Tết Trung Thu • Đêm Hội Trăng Rằm' },
    { eventId: 'event_sinh_nhat', name: 'Tiệc Sinh Nhật • Happy Birthday' },
    { eventId: 'event_ky_yeu_tot_nghiep', name: 'Kỷ Yếu Tốt Nghiệp • Thanh Xuân Rực Rỡ' },
    { eventId: 'event_le_hang_thuan', name: 'Lễ Hằng Thuận & Đính Hôn' },
    { eventId: 'event_giang_sinh', name: 'Đêm Giáng Sinh • Christmas & New Year' },
    { eventId: 'event_giai_dieu_mua_he', name: 'Lễ Hội Mùa Hè • Summer Beach Fest' },
    { eventId: 'event_year_end_party', name: 'Year End Party • Gala Tri Ân Cuối Năm' },
  ];

  try {
    const insertStmt = adminDb.prepare(`
      INSERT INTO events (event_id, name, status, created_at, updated_at)
      VALUES (?, ?, 'active', ?, ?)
      ON CONFLICT(event_id) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at
    `);
    for (const item of popularEvents) {
      insertStmt.run(item.eventId, item.name, now, now);
    }
  } catch {}

  adminDb.pragma('foreign_keys = ON');

  return adminDb;
}

function listTemplates(eventId, captureFormatId) {
  const format = captureFormats.find((item) => item.id === captureFormatId) || captureFormats[0];
  const targetShotCount = format.slotCount;
  const cleanEventId = eventId || 'event_hoi_an_heritage';

  // 1. First check SQLite DB for published frames imported from Admin
  const importedTemplates = [];
  try {
    const db = ensureAdminDb();
    const rows = db.prepare("SELECT definition_json FROM admin_frames WHERE status = 'published'").all();

    for (const row of rows) {
      try {
        const def = JSON.parse(row.definition_json);
        const shotCount = def.shotCount || (def.slots ? def.slots.length : 0);
        if (shotCount === targetShotCount || targetShotCount === 3 || shotCount === 1) {
          const isLandscape = def.orientation === 'landscape' || (def.outputWidth && def.outputHeight ? def.outputWidth > def.outputHeight : false);
          importedTemplates.push({
            templateId: def.id,
            eventId: def.eventId || cleanEventId,
            captureFormatId,
            name: def.name || 'Khung Import Canva',
            status: 'PUBLISHED',
            orientation: isLandscape ? 'landscape' : 'portrait',
            outputWidth: def.outputWidth || 1800,
            outputHeight: def.outputHeight || 2700,
            canvas: { width: def.outputWidth || 1800, height: def.outputHeight || 2700 },
            slots: (def.slots || []).map((slot, index) => ({
              slotIndex: index + 1,
              x: slot.x <= 1 ? slot.x * 100 : slot.x,
              y: slot.y <= 1 ? slot.y * 100 : slot.y,
              width: slot.width <= 1 ? slot.width * 100 : slot.width,
              height: slot.height <= 1 ? slot.height * 100 : slot.height,
            })),
            assets: {
              background: '#FDFCFB',
              overlay: def.assetUrl,
              overlayColor: 'transparent',
              textColor: '#1A1A1A',
            },
            customization: { allowTyping: false, allowDraw: Boolean(def.allowDraw) },
            printProfile: { paper: '4x6', orientation: isLandscape ? 'landscape' : 'portrait', dpi: 300 },
          });
        }
      } catch {
        // Skip bad JSON
      }
    }
  } catch {
    // Ignore SQLite errors
  }

  // 2. Also check in-memory adminTemplates map
  const inMemoryImported = Array.from(adminTemplates.values())
    .filter((def) => def.status === 'published' && (!def.eventId || def.eventId === cleanEventId) && (def.shotCount === targetShotCount || (def.slots && def.slots.length === targetShotCount)))
    .map((def) => {
      const isLandscape = def.orientation === 'landscape' || (def.outputWidth && def.outputHeight ? def.outputWidth > def.outputHeight : false);
      return {
        templateId: def.id,
        eventId: def.eventId || cleanEventId,
        captureFormatId,
        name: def.name || 'Khung Import Canva',
        status: 'PUBLISHED',
        orientation: isLandscape ? 'landscape' : 'portrait',
        outputWidth: def.outputWidth || 1800,
        outputHeight: def.outputHeight || 2700,
        canvas: { width: def.outputWidth || 1800, height: def.outputHeight || 2700 },
        slots: (def.slots || []).map((slot, index) => ({
          slotIndex: index + 1,
          x: slot.x <= 1 ? slot.x * 100 : slot.x,
          y: slot.y <= 1 ? slot.y * 100 : slot.y,
          width: slot.width <= 1 ? slot.width * 100 : slot.width,
          height: slot.height <= 1 ? slot.height * 100 : slot.height,
        })),
        assets: {
          background: '#FDFCFB',
          overlay: def.assetUrl,
          overlayColor: 'transparent',
          textColor: '#1A1A1A',
        },
        customization: { allowTyping: false, allowDraw: Boolean(def.allowDraw) },
        printProfile: { paper: '4x6', orientation: isLandscape ? 'landscape' : 'portrait', dpi: 300 },
      };
    });

  const combined = [...importedTemplates, ...inMemoryImported];
  return Array.from(new Map(combined.map((f) => [f.templateId || f.id, f])).values());
}

function assertAdminId(value, label) {
  const normalized = String(value || '');
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(normalized)) throw new Error(`Invalid ${label}.`);
  return normalized;
}

function listAdminTemplates(eventId) {
  const scopedEventId = eventId ? String(eventId || '').trim() : undefined;
  const result = [];
  try {
    const db = ensureAdminDb();
    const rows = db.prepare('SELECT definition_json FROM admin_frames ORDER BY updated_at DESC').all();
    for (const row of rows) {
      try {
        const def = JSON.parse(row.definition_json);
        result.push(def);
      } catch {
        // Skip invalid JSON
      }
    }
  } catch {
    // Ignore DB errors
  }
  const memoryFrames = Array.from(adminTemplates.values()).filter((frame) => !scopedEventId || frame.eventId === scopedEventId);
  const combined = [...result, ...memoryFrames];
  return Array.from(new Map(combined.map((f) => [f.id || f.templateId, f])).values());
}

function saveAdminTemplate(eventId, frame) {
  const scopedEventId = String(eventId || 'event_hoi_an_heritage').trim();
  const id = String(frame?.id || frame?.templateId || `frame_${Date.now()}`).trim();
  const status = frame?.status === 'private' ? 'private' : 'published';
  const itemToSave = { ...frame, id, templateId: id, eventId: scopedEventId, status };
  try {
    const db = ensureAdminDb();
    const now = nowIso();
    db.prepare(`
      INSERT INTO admin_frames (frame_id, event_id, definition_json, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(frame_id) DO UPDATE SET
        event_id = excluded.event_id,
        definition_json = excluded.definition_json,
        status = excluded.status,
        updated_at = excluded.updated_at
    `).run(id, scopedEventId, JSON.stringify(itemToSave), status, now, now);
  } catch (err) {
    console.warn('Failed to save frame to SQLite DB:', err);
  }
  adminTemplates.set(id, itemToSave);
}

function setAdminTemplateStatus(templateId, eventId, status) {
  const id = String(templateId || '').trim();
  const scopedEventId = String(eventId || 'event_hoi_an_heritage').trim();
  try {
    const db = ensureAdminDb();
    const now = nowIso();
    db.prepare('UPDATE admin_frames SET status = ?, updated_at = ? WHERE frame_id = ? OR frame_id = ?').run(status, now, id, `${scopedEventId}_${id}`);
  } catch {
    // Ignore DB errors
  }
  const frame = adminTemplates.get(id);
  if (frame) {
    adminTemplates.set(id, { ...frame, status });
  }
}

function removeAdminTemplate(eventId, templateId) {
  const cleanEventId = String(eventId || 'event_hoi_an_heritage');
  const cleanId = String(templateId || '');
  try {
    const db = ensureAdminDb();
    db.prepare('DELETE FROM admin_frames WHERE frame_id = ? OR frame_id = ?').run(cleanId, `${cleanEventId}_${cleanId}`);
  } catch {
    // Ignore DB errors
  }
  adminTemplates.delete(cleanId);
}

function clearAdminTemplates(eventId) {
  const cleanEventId = String(eventId || '');
  try {
    const db = ensureAdminDb();
    db.prepare('DELETE FROM admin_frames').run();
  } catch {
    // Ignore DB errors
  }
  adminTemplates.clear();
}

function ensureStorageDb() {
  if (storageDb) return storageDb;
  fs.mkdirSync(path.join(storageRoot, 'sessions'), { recursive: true });
  storageDb = new Database(storageDbFile);
  storageDb.pragma('journal_mode = WAL');
  storageDb.exec(`CREATE TABLE IF NOT EXISTS sessions (session_id TEXT PRIMARY KEY, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, payload_json TEXT); CREATE TABLE IF NOT EXISTS stored_files (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, relative_path TEXT NOT NULL, mime_type TEXT NOT NULL, width INTEGER, height INTEGER, bytes INTEGER NOT NULL, output_type TEXT, created_at TEXT NOT NULL);`);
  return storageDb;
}

function assertStorageId(value, label) {
  const normalized = String(value || '');
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(normalized)) throw new Error(`Invalid ${label}.`);
  return normalized;
}

function assertImageMime(mimeType) {
  const value = String(mimeType || '');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(value)) throw new Error('Invalid image mime type.');
  return value;
}

function assertOutputTypeValue(type) {
  const value = String(type || '');
  if (!['master', 'share', 'print', 'preview', 'customization'].includes(value)) throw new Error('Invalid output type.');
  return value;
}

function extensionForMime(mimeType) {
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/webp') return '.webp';
  return '.jpg';
}

function binaryBytes(input) {
  if (input instanceof Uint8Array) return Buffer.from(input);
  if (Array.isArray(input)) return Buffer.from(input);
  if (typeof input === 'string') return Buffer.from(input.split(',').pop() || input, 'base64');
  return Buffer.alloc(0);
}

function createStorageSession(sessionId) {
  const safeSessionId = assertStorageId(sessionId, 'session id');
  const db = ensureStorageDb();
  fs.mkdirSync(path.join(storageRoot, 'sessions', safeSessionId, 'originals'), { recursive: true });
  fs.mkdirSync(path.join(storageRoot, 'sessions', safeSessionId, 'outputs'), { recursive: true });
  const now = nowIso();
  db.prepare('INSERT INTO sessions (session_id, created_at, updated_at, payload_json) VALUES (?, ?, ?, NULL) ON CONFLICT(session_id) DO UPDATE SET updated_at = excluded.updated_at').run(safeSessionId, now, now);
}

function saveStorageFile(sessionId, relativePath, id, file, outputType, allowOverwrite) {
  const db = ensureStorageDb();
  const absolutePath = path.join(storageRoot, relativePath);
  if (!allowOverwrite && (fs.existsSync(absolutePath) || db.prepare('SELECT id FROM stored_files WHERE id = ?').get(id))) throw new Error('Original already exists and will not be overwritten.');
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  const bytes = binaryBytes(file?.bytes || file?.dataUrl || '');
  if (bytes.byteLength <= 0) throw new Error('Image bytes are empty.');
  const tempPath = `${absolutePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tempPath, bytes);
  fs.renameSync(tempPath, absolutePath);
  const now = nowIso();
  const stored = { id, sessionId, relativePath, mimeType: String(file?.mimeType || 'image/jpeg'), width: file?.width, height: file?.height, bytes: bytes.byteLength, createdAt: now, outputType };
  db.prepare('INSERT INTO stored_files (id, session_id, relative_path, mime_type, width, height, bytes, output_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET relative_path = excluded.relative_path, mime_type = excluded.mime_type, width = excluded.width, height = excluded.height, bytes = excluded.bytes, output_type = excluded.output_type, created_at = excluded.created_at').run(stored.id, stored.sessionId, stored.relativePath, stored.mimeType, stored.width ?? null, stored.height ?? null, stored.bytes, stored.outputType ?? null, stored.createdAt);
  return stored;
}

function getReadiness() {
  const reasons = [];
  if (!activeEventConfig || activeEventConfig.status !== 'active') reasons.push('NO_ACTIVE_EVENT');
  for (const [component, status] of Object.entries(healthSnapshot)) {
    if (status === 'blocked') reasons.push(`${component.toUpperCase()}_BLOCKED`);
  }
  const degraded = Object.entries(healthSnapshot).filter(([, status]) => status === 'degraded').map(([component]) => `${component.toUpperCase()}_DEGRADED`);
  const activeEvent = activeEventConfig ? { ...activeEventConfig, enabledShotFormats: [...activeEventConfig.enabledShotFormats] } : null;
  const health = { ...healthSnapshot };
  if (reasons.length > 0) return { status: 'BLOCKED', activeEvent, health, reasons };
  if (degraded.length > 0) return { status: 'DEGRADED', activeEvent, health, reasons: degraded };
  return { status: 'READY', activeEvent, health, reasons: [] };
}

function readinessAllowsGuestStart(readiness) {
  if (readiness.status === 'BLOCKED' || !readiness.activeEvent) return false;
  return !['camera', 'storage', 'database', 'composition'].some((component) => readiness.health[component] === 'degraded');
}

function listEnabledCaptureFormats() {
  const enabled = activeEventConfig?.enabledShotFormats || [];
  return captureFormats.filter((format) => enabled.includes(format.id));
}

function safeGuest(fn) {
  try {
    const res = fn();
    if (res && typeof res.then === 'function') {
      return res.then((val) => ok(val)).catch((cause) => ({
        ok: false,
        error: {
          code: 'GUEST_SESSION_MAIN_ERROR',
          domain: 'platform',
          severity: 'warning',
          technicalMessage: cause instanceof Error ? cause.message : 'Guest session failed.',
          guestMessage: 'Phiên chụp đang cần hỗ trợ.',
          recoverable: true,
        },
      }));
    }
    return ok(res);
  } catch (cause) {
    return {
      ok: false,
      error: {
        code: 'GUEST_SESSION_MAIN_ERROR',
        domain: 'platform',
        severity: 'warning',
        technicalMessage: cause instanceof Error ? cause.message : 'Guest session failed.',
        guestMessage: 'Phiên chụp đang cần hỗ trợ.',
        recoverable: true,
      },
    };
  }
}

function registerSkeletonIpc() {

  ipcMain.handle('cameraos:admin:auth:unlock', (_event, passcode) => String(passcode || '') === (process.env.MOMENTAI_ADMIN_PASSCODE || '0000') ? ok({ token: `admin_${Date.now()}`, expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString() }) : unavailable('ADMIN_PASSCODE_INVALID'));
  ipcMain.handle('cameraos:admin:auth:lock', () => ok(undefined));
  ipcMain.handle('cameraos:admin:auth:verify', () => ok(undefined));
  ipcMain.handle('cameraos:admin:events:list', () => ok(Array.from(adminEvents.values())));
  ipcMain.handle('cameraos:admin:events:create', (_event, name) => {
    const eventName = String(name || 'Event');
    const eventId = `event_${eventName.toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'event'}`;
    const event = { eventId, name: eventName, status: 'active' };
    adminEvents.set(eventId, event);
    return ok(event);
  });
  ipcMain.handle('cameraos:admin:templates:list', (_event, eventId) => safeGuest(() => listAdminTemplates(typeof eventId === 'string' ? eventId : undefined)));
  ipcMain.handle('cameraos:admin:templates:publish', (_event, templateId, eventId) => safeGuest(() => { setAdminTemplateStatus(templateId, eventId, 'published'); return undefined; }));
  ipcMain.handle('cameraos:admin:templates:archive', (_event, templateId, eventId) => safeGuest(() => { setAdminTemplateStatus(templateId, eventId, 'private'); return undefined; }));
  ipcMain.handle('cameraos:admin:templates:save', (_event, eventId, frame) => safeGuest(() => { saveAdminTemplate(String(eventId || 'event_hoi_an_heritage'), frame); return undefined; }));
  ipcMain.handle('cameraos:admin:templates:remove', (_event, eventId, templateId) => safeGuest(() => { removeAdminTemplate(String(eventId || ''), templateId); return undefined; }));
  ipcMain.handle('cameraos:admin:templates:clear', (_event, eventId) => safeGuest(() => { clearAdminTemplates(String(eventId || '')); return undefined; }));
  ipcMain.handle('cameraos:admin:health:snapshot', () => ok({ camera: 'unknown', printer: 'unknown', storage: 'ready', network: 'unknown', hardwareStatus: 'not-tested' }));
  ipcMain.handle('cameraos:admin:cleanup:summary', () => ok({ config: { enabled: true, retentionMinutes: 10, cleanupIntervalSeconds: 60, mode: 'audit_minimal', deferWhilePrintActive: true, printCleanupGraceMinutes: 30 }, pending: 0, eligible: 0, deleted: 0, failed: 0 }));
  ipcMain.handle('cameraos:admin:cleanup:run-now', () => ok([]));
  ipcMain.handle('cameraos:admin:logs:tail', (_event, limit) => safeGuest(() => {
    const maxLines = Math.max(1, Math.min(Number(limit) || 50, 500));
    if (!fs.existsSync(systemLogFile)) {
      return [{ timestamp: new Date().toISOString(), level: 'info', event: 'windowmini.desktop.boot', message: 'No structured log file has been created yet. Canon shadow logs are written to the configured local artifacts log directory.' }];
    }
    return fs.readFileSync(systemLogFile, 'utf8')
      .split('\n')
      .filter(Boolean)
      .slice(-maxLines)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return { timestamp: new Date().toISOString(), level: 'warn', event: 'windowmini.admin.logs.parse_failed', message: line };
        }
      });
  }));

  ipcMain.handle('cameraos:storage:health', () => safeGuest(() => {
    fs.mkdirSync(storageRoot, { recursive: true });
    fs.accessSync(storageRoot, fs.constants.R_OK | fs.constants.W_OK);
    ensureStorageDb();
    return { status: 'ready', rootLabel: 'LocalFilesystemSQLiteStorage' };
  }));
  ipcMain.handle('cameraos:storage:session:create', (_event, sessionId) => safeGuest(() => { createStorageSession(sessionId); return undefined; }));
  ipcMain.handle('cameraos:storage:original:save', (_event, sessionId, shotIndex, photo) => safeGuest(() => {
    const safeSessionId = assertStorageId(sessionId, 'session id');
    const safeShotIndex = Number(shotIndex);
    if (!Number.isInteger(safeShotIndex) || safeShotIndex < 1 || safeShotIndex > 12) throw new Error('Invalid shot index.');
    createStorageSession(safeSessionId);
    const mimeType = assertImageMime(photo?.mimeType || 'image/jpeg');
    const relativePath = path.posix.join('sessions', safeSessionId, 'originals', `shot_${String(safeShotIndex).padStart(2, '0')}${extensionForMime(mimeType)}`);
    return saveStorageFile(safeSessionId, relativePath, `original_${safeSessionId}_${safeShotIndex}`, { ...photo, mimeType }, undefined, false);
  }));
  ipcMain.handle('cameraos:storage:output:save', (_event, sessionId, type, file) => safeGuest(() => {
    const safeSessionId = assertStorageId(sessionId, 'session id');
    const outputType = assertOutputTypeValue(type);
    createStorageSession(safeSessionId);
    const mimeType = assertImageMime(file?.mimeType || 'image/jpeg');
    const relativePath = path.posix.join('sessions', safeSessionId, 'outputs', `${outputType}${extensionForMime(mimeType)}`);
    return saveStorageFile(safeSessionId, relativePath, `output_${safeSessionId}_${outputType}`, { ...file, mimeType }, outputType, true);
  }));

  ipcMain.handle('cameraos:camera:status', () => safeGuest(() => {
    if (canonBridge.state === 'READY' || canonBridge.state === 'LIVEVIEW') {
      return {
        provider: 'canon',
        preferredProvider: 'canon',
        fallbackActive: false,
        liveView: true,
        stillCapture: true,
        hardwareStatus: 'ready',
        model: canonBridge.cameraModel || 'Canon EOS 6D',
        state: canonBridge.state,
      };
    }
    writeCanonShadowLog('GetDeviceInformation', { reason: 'mac-device-camera-development-status' });
    return {
      provider: 'mac-device-camera',
      preferredProvider: 'canon',
      fallbackActive: true,
      liveView: true,
      stillCapture: true,
      hardwareStatus: 'partial',
      logRef: 'canon-shadow',
      note: 'Using Mac/device camera for development fallback; Canon camera not active.',
    };
  }));

  ipcMain.handle('cameraos:camera:capture', async (_event, context) => safeGuest(async () => {
    const sessionId = typeof context?.sessionId === 'string' ? context.sessionId : 'unknown_session';
    const shotIndex = Number.isFinite(Number(context?.shotIndex)) ? Number(context.shotIndex) : 1;
    const correlationId = typeof context?.correlationId === 'string' ? context.correlationId : `canon_${Date.now()}_${shotIndex}`;

    if (canonBridge.state === 'READY' || canonBridge.state === 'LIVEVIEW') {
      const sessionDir = path.join(storageRoot, 'sessions', sessionId, 'originals');
      fs.mkdirSync(sessionDir, { recursive: true });
      const targetPath = path.join(sessionDir, `shot_${String(shotIndex).padStart(2, '0')}.jpg`);

      const result = await canonBridge.capture({
        sessionId,
        shotIndex,
        targetPath,
      });

      const fileBuffer = fs.readFileSync(result.path);
      const dataUrl = `data:image/jpeg;base64,${fileBuffer.toString('base64')}`;

      writeSystemLog('info', 'CANON:CAPTURE_SUCCESS', `Real Canon 6D shot ${shotIndex} persisted to ${result.path}`, {
        sessionId,
        shotIndex,
        correlationId,
        size: result.size,
        width: result.width,
        height: result.height,
        path: result.path,
      });

      return {
        ok: true,
        provider: 'canon',
        preferredProvider: 'canon',
        fallbackActive: false,
        sessionId,
        shotIndex,
        correlationId,
        photo: {
          id: `canon_photo_${Date.now()}_${shotIndex}`,
          sessionId,
          shotIndex,
          localPath: result.path,
          dataUrl,
          width: result.width || 5472,
          height: result.height || 3648,
          size: result.size,
          provider: 'canon',
        },
      };
    }

    writeCanonShadowLog('OpenSession', { sessionId, shotIndex, correlationId });
    writeCanonShadowLog('StartLiveView', { sessionId, shotIndex, correlationId });
    writeCanonShadowLog('PressShutter', { sessionId, shotIndex, correlationId });
    writeCanonShadowLog('DownloadObject', { sessionId, shotIndex, correlationId });
    return {
      provider: 'mac-device-camera',
      preferredProvider: 'canon',
      fallbackActive: true,
      simulatedCanon: true,
      sessionId,
      shotIndex,
      correlationId,
      status: 'shadow-command-logged',
      logRef: 'canon-shadow',
    };
  }));

  ipcMain.handle('cameraos:camera:autofocus', (_event, context) => safeGuest(() => {
    const sessionId = typeof context?.sessionId === 'string' ? context.sessionId : 'unknown_session';
    const correlationId = typeof context?.correlationId === 'string' ? context.correlationId : `af_${Date.now()}`;
    writeCanonShadowLog('DoEvfAF', { sessionId, correlationId, mode: 'AI SERVO', status: 'focused' });
    return { provider: canonBridge.state === 'READY' || canonBridge.state === 'LIVEVIEW' ? 'canon' : 'canon-shadow', status: 'focused', correlationId };
  }));

  ipcMain.handle('cameraos:camera:liveview:start', async (_event, context) => safeGuest(async () => {
    const sessionId = typeof context?.sessionId === 'string' ? context.sessionId : 'unknown_session';
    if (canonBridge.state === 'READY' || canonBridge.state === 'LIVEVIEW') {
      await canonBridge.startLiveView();
      return { provider: 'canon', liveViewRunning: true };
    }
    writeCanonShadowLog('StartLiveView', { sessionId, outputDevice: 'PC_AND_EVF' });
    return { provider: 'canon-shadow', liveViewRunning: true };
  }));

  ipcMain.handle('cameraos:camera:liveview:stop', async (_event, context) => safeGuest(async () => {
    const sessionId = typeof context?.sessionId === 'string' ? context.sessionId : 'unknown_session';
    if (canonBridge.state === 'LIVEVIEW') {
      await canonBridge.stopLiveView();
      return { provider: 'canon', liveViewRunning: false };
    }
    writeCanonShadowLog('StopLiveView', { sessionId });
    return { provider: 'canon-shadow', liveViewRunning: false };
  }));

  ipcMain.handle('cameraos:camera:recording:start', (_event, context) => safeGuest(() => {
    const sessionId = typeof context?.sessionId === 'string' ? context.sessionId : 'unknown_session';
    const correlationId = typeof context?.correlationId === 'string' ? context.correlationId : `rec_${Date.now()}`;
    writeCanonShadowLog('StartMovieRecording', { sessionId, correlationId, mode: 'FULL_HD_30FPS', trigger: 'gesture_detect' });
    return { provider: 'canon-shadow', recording: true, sessionId, correlationId };
  }));

  ipcMain.handle('cameraos:camera:recording:stop', (_event, context) => safeGuest(() => {
    const sessionId = typeof context?.sessionId === 'string' ? context.sessionId : 'unknown_session';
    const correlationId = typeof context?.correlationId === 'string' ? context.correlationId : `rec_stop_${Date.now()}`;
    writeCanonShadowLog('StopMovieRecording', { sessionId, correlationId, status: 'completed' });
    writeCanonShadowLog('DownloadMovieObject', { sessionId, correlationId, target: 'session_outputs' });
    return { provider: 'canon-shadow', recording: false, sessionId, correlationId };
  }));

  ipcMain.handle('cameraos:guest:readiness:get', () => safeGuest(getReadiness));
  ipcMain.handle('cameraos:guest:session:start', (_event, eventId) => safeGuest(() => {
    const readiness = getReadiness();
    if (!readinessAllowsGuestStart(readiness)) throw new Error(`Guest start blocked: ${readiness.reasons.join(',') || 'NO_ACTIVE_EVENT'}`);
    const requestedEventId = typeof eventId === 'string' ? eventId : readiness.activeEvent.eventId;
    if (requestedEventId !== readiness.activeEvent.eventId) throw new Error('Requested event is not active.');
    const session = createGuestSession(requestedEventId);
    sessions.set(session.sessionId, session);
    return session;
  }));
  ipcMain.handle('cameraos:guest:session:get', (_event, sessionId) => safeGuest(() => sessions.get(String(sessionId || '')) || null));
  ipcMain.handle('cameraos:guest:capture-formats:list', () => ok(listEnabledCaptureFormats()));
  ipcMain.handle('cameraos:guest:format:select', (_event, sessionId, formatId) => safeGuest(() => {
    const session = requireGuestSession(String(sessionId || ''));
    const captureFormat = listEnabledCaptureFormats().find((format) => format.id === String(formatId || ''));
    if (!captureFormat) throw new Error('Invalid capture format.');
    return touch({ ...session, captureFormat, photos: [], selectedTemplate: null, slotAssignments: [], outputs: { master: null, share: null, print: null } }, 'READY_TO_CAPTURE');
  }));
  ipcMain.handle('cameraos:guest:photo:add', (_event, sessionId, photo) => safeGuest(() => {
    const session = requireGuestSession(String(sessionId || ''));
    if (!session.captureFormat) throw new Error('Capture format is required before capture.');
    const shotIndex = Number(photo?.shotIndex || 0);
    const nextPhoto = {
      photoId: String(photo?.photoId || `photo_${Date.now()}`),
      sessionId: session.sessionId,
      shotIndex,
      originalPath: String(photo?.originalPath || `originals/capture_${String(shotIndex).padStart(2, '0')}.jpg`),
      status: 'valid',
      capturedAt: nowIso(),
      dataUrl: typeof photo?.dataUrl === 'string' ? photo.dataUrl : undefined,
    };
    const photos = [...session.photos.filter((existing) => existing.photoId !== nextPhoto.photoId), nextPhoto].sort((a, b) => a.shotIndex - b.shotIndex);
    const nextStatus = photos.filter((item) => item.status === 'valid').length >= session.captureFormat.shotCount ? 'SELECTING_TEMPLATE' : 'CAPTURING';
    return touch({ ...session, photos }, nextStatus);
  }));
  ipcMain.handle('cameraos:guest:templates:list', (_event, eventId, captureFormatId) => ok(listTemplates(String(eventId || 'event_hoi_an_heritage'), String(captureFormatId || 'format_1shot'))));
  ipcMain.handle('cameraos:guest:template:select', (_event, sessionId, templateId) => safeGuest(() => {
    const session = requireGuestSession(String(sessionId || ''));
    if (!session.captureFormat) throw new Error('Capture format is required before template selection.');
    const template = listTemplates(session.eventId, session.captureFormat.id).find((item) => item.templateId === String(templateId || '')) || listTemplates(session.eventId, session.captureFormat.id)[0];
    const slotAssignments = template.slots.map((slot) => {
      const photo = session.photos.find((item) => item.shotIndex === slot.slotIndex);
      if (!photo) throw new Error(`Missing original photo for slot ${slot.slotIndex}.`);
      return { slotIndex: slot.slotIndex, photoId: photo.photoId };
    });
    return touch({ ...session, selectedTemplate: template, slotAssignments }, template.customization.allowTyping || template.customization.allowDraw ? 'CUSTOMIZING' : 'COMPOSING');
  }));
  ipcMain.handle('cameraos:guest:customization:save', (_event, sessionId, customization) => safeGuest(() => touch({ ...requireGuestSession(String(sessionId || '')), customization: customization || { text: [], drawing: [] } }, 'COMPOSING')));
  ipcMain.handle('cameraos:guest:compose', (_event, sessionId) => safeGuest(() => {
    const session = requireGuestSession(String(sessionId || ''));
    const safeToken = encodeURIComponent(session.sessionId);
    return touch({ ...session, outputs: { master: `/outputs/${safeToken}/final-master.png`, share: `/outputs/${safeToken}/final-share.jpg`, print: `/outputs/${safeToken}/final-print.jpg` }, qr: { url: '', status: 'failed' } }, 'RESULT_READY');
  }));
  ipcMain.handle('cameraos:guest:print:request', (_event, sessionId, copies) => safeGuest(() => {
    const session = requireGuestSession(String(sessionId || ''));
    const enqueueResult = printQueue.enqueue(session, { copies: Number(copies) || 1 });
    if (!enqueueResult.ok) {
      throw new Error(enqueueResult.error?.message || 'Print enqueue failed.');
    }
    return touch({ ...session, printJob: enqueueResult.value }, session.status);
  }));
  ipcMain.handle('cameraos:guest:complete', (_event, sessionId) => safeGuest(() => {
    const session = requireGuestSession(String(sessionId || ''));
    const now = nowIso();
    const updated = touch({ ...session, completedAt: now }, 'COMPLETED');
    checkAndCompleteSession(session.sessionId);
    return ok(updated);
  }));
}

let lastFrameBroadcast = 0;
canonBridge.on('liveViewFrame', (frame) => {
  const now = Date.now();
  if (now - lastFrameBroadcast >= 33) {
    lastFrameBroadcast = now;
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send('cameraos:camera:evf:frame', frame);
      }
    }
  }
});

app.whenReady().then(async () => {
  writeSystemLog('info', 'WINDOWMINI:BOOT', 'MomentAI CameraOS Electron Main booted.');
  registerSkeletonIpc();
  printQueue.init();
  initSessionCleanupScheduler();
  createWindow('guest');

  try {
    const canonOk = await canonBridge.start();
    if (canonOk) {
      writeSystemLog('info', 'CANON:CONNECTED', `Canon camera ${canonBridge.cameraModel} connected and ready.`);
    } else {
      writeSystemLog('info', 'CANON:FALLBACK', 'Canon not available on boot; falling back to device camera.');
    }
  } catch (err) {
    writeSystemLog('warn', 'CANON:START_ERROR', `Canon start error: ${err.message}`);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow('guest');
  });
});

app.on('window-all-closed', () => {
  canonBridge.shutdown();
  if (process.platform !== 'darwin') app.quit();
});
