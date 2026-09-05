const { app, BrowserWindow, ipcMain, screen } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const url = require('node:url');
const Database = require('better-sqlite3');
const { CanonRuntimeClient } = require('../../camera-runtime/canon-runtime-client.cjs');
const { STATES } = require('../../camera-runtime/protocol.cjs');
const { desktopMediaManager } = require('./media/desktop-media-manager.cjs');
const { SessionMediaPaths } = require('./storage/session-media-paths.cjs');
const { cloudSyncCoordinator } = require('./cloud/cloud-sync-coordinator.cjs');

// ── Windows DPI Fix ────────────────────────────────────────────────────────────
// Must be called BEFORE app.ready. Prevents Windows DPI virtualization from
// causing Chromium to render at a scaled-down resolution and then stretching it,
// which makes frames look squished and circles look like ellipses at 125%/150% DPI.
// On Mac/Linux these flags are no-ops.
app.commandLine.appendSwitch('force-device-scale-factor', '1');
// ──────────────────────────────────────────────────────────────────────────────


// 1. Single Instance Lock (Prevents duplicate instances colliding on USB devices)
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  console.warn('[ELECTRON_BOOT] Another instance is already running. Quitting duplicate instance.');
  app.quit();
  process.exit(0);
} else {
  app.on('second-instance', () => {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
      const mainWin = windows[0];
      if (mainWin.isMinimized()) mainWin.restore();
      mainWin.focus();
    }
  });
}

const canonRuntime = new CanonRuntimeClient();
let sessionMediaPaths = null;

function logCameraRuntimeStatus(tag = 'STATUS_UPDATE') {
  const preferred = 'canon';
  const isPhysicalUsb = Boolean(canonRuntime.physicalUsbPresent || canonRuntime.cameraCount > 0);
  const usbPresent = isPhysicalUsb ? 'YES' : 'NO';
  const sessionState = canonRuntime.state;
  const isEnumeratePending = canonRuntime.state === STATES.ENUMERATING || canonRuntime.state === STATES.DISCOVERY_WAIT;
  const isPtpUnresponsive = canonRuntime.state === STATES.CAMERA_PTP_UNRESPONSIVE;
  const isAuthoritativeNoCanon = !isPhysicalUsb && (canonRuntime.state === STATES.CAMERA_NOT_FOUND || (canonRuntime.cameraCount === 0 && canonRuntime.state === STATES.DISCONNECTED));
  const fallbackEligible = (isAuthoritativeNoCanon || isPtpUnresponsive || canonRuntime.state === STATES.ERROR) ? 'YES' : 'NO';
  const fallbackReason = isPtpUnresponsive
    ? 'CANON_PTP_UNRESPONSIVE'
    : (isAuthoritativeNoCanon ? 'NO_CANON_HARDWARE' : (canonRuntime.state === STATES.ERROR ? 'CANON_TERMINAL_FAILED' : 'NONE'));
  const activeProvider = isAuthoritativeNoCanon
    ? 'mac-device-camera'
    : (canonRuntime.state === STATES.READY || canonRuntime.state === STATES.LIVEVIEW ? 'canon' : 'canon-connecting');
  const previewSource = activeProvider === 'canon'
    ? 'Canon EDSDK EVF'
    : (activeProvider === 'canon-connecting' ? (isEnumeratePending ? 'Discovering Canon Camera...' : 'Connecting Canon EVF...') : 'Mac Device Camera');

  console.log(`\n========================================`);
  console.log(`[CAMERA_RUNTIME:${tag}]`);
  console.log(`  CAMERA_PROVIDER_PREFERRED = ${preferred}`);
  console.log(`  CANON_USB_PRESENT         = ${usbPresent}`);
  console.log(`  CANON_SESSION_STATE       = ${sessionState}`);
  console.log(`  FALLBACK_ELIGIBLE         = ${fallbackEligible}`);
  console.log(`  FALLBACK_REASON           = ${fallbackReason}`);
  console.log(`  ACTIVE_CAMERA_PROVIDER    = ${activeProvider}`);
  console.log(`  ACTIVE_PREVIEW_SOURCE     = ${previewSource}`);
  console.log(`========================================\n`);
}

const isDev = !app.isPackaged;
const rendererUrl =
  process.env.WINDOWMINI_RENDERER_URL || 'http://localhost:5173';

const isKiosk = process.env.MOMENTAI_KIOSK_MODE === 'true' || process.argv.includes('--kiosk');

const projectRoot = path.resolve(__dirname, '../../../..');
const defaultStorageRoot = app.isPackaged
  ? path.join(app.getPath('userData'), 'storage')
  : path.join(projectRoot, 'artifacts', 'windowmini-storage');
const defaultLogDir = app.isPackaged
  ? path.join(app.getPath('userData'), 'logs')
  : path.join(projectRoot, 'artifacts', 'logs');

const logDir = process.env.MOMENTAI_LOG_DIR || defaultLogDir;
const systemLogFile = path.join(logDir, 'momentai-cameraos.log');
const canonShadowLogFile = path.join(logDir, 'canon-shadow.log');
const storageRoot = path.resolve(process.env.MOMENTAI_STORAGE_DIR || defaultStorageRoot);
sessionMediaPaths = new SessionMediaPaths(storageRoot);
desktopMediaManager.setStorageRootDir(storageRoot);
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
  console.log(`[DISPLAY_AUDIT] PRIMARY_SCALE_FACTOR = ${primaryDisplay.scaleFactor}`);
  console.log(`[DISPLAY_AUDIT] SECONDARY_DISPLAY = ${JSON.stringify(secondaryDisplay?.bounds || null)}`);
  console.log(`[DISPLAY_AUDIT] SECONDARY_SCALE_FACTOR = ${secondaryDisplay?.scaleFactor || 'N/A'}`);
  console.log(`[DISPLAY_AUDIT] ELECTRON_DISPLAY = ${targetDisplay.id === primaryDisplay.id ? 'PRIMARY' : 'SECONDARY'}`);
  console.log(`[DISPLAY_AUDIT] TARGET_SCALE_FACTOR = ${targetDisplay.scaleFactor}`);
  console.log(`[DISPLAY_AUDIT] ELECTRON_WINDOW_BOUNDS = ${JSON.stringify({ x, y, width, height })}`);
  console.log(`[DISPLAY_AUDIT] KIOSK_MODE_ENABLED = ${isKiosk ? 'YES' : 'NO'}`);

  const win = new BrowserWindow({
    x,
    y,
    width,
    height,
    // useContentSize: true ensures width/height refer to the content area (viewport),
    // not the outer window frame. Without this, Windows border (8px each side)
    // and title bar shrink the actual content area below the intended 1920x1080.
    useContentSize: !isKiosk,
    frame: !isKiosk,
    kiosk: isKiosk,
    fullscreen: isKiosk,
    fullscreenable: true,
    autoHideMenuBar: true,
    show: false,
    backgroundColor: isGuest ? '#FDFCFB' : '#111111',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      // Prevent Chromium from applying an additional zoom factor that could
      // distort aspect ratios and make circles appear as ellipses on Windows.
      zoomFactor: 1.0,
    },
  });

  // Forward renderer console messages to Electron terminal for instant debugging
  win.webContents.on('console-message', (event, level, message, line, sourceId) => {
    const levelNames = ['VERBOSE', 'INFO', 'WARNING', 'ERROR'];
    const levelName = levelNames[level] || 'LOG';
    if (level >= 2 || isDev) {
      console.log(`[RENDERER_${levelName}] ${message} (${sourceId}:${line})`);
    }
  });

  // Hotkey Escape Hatch for Operators (Ctrl+Shift+A for Admin, Ctrl+Shift+Q for Quit, F11 for Fullscreen, F12 for DevTools)
  win.webContents.on('before-input-event', (event, input) => {
    const isControlOrMeta = input.control || input.meta;
    const isShift = input.shift;

    if (isControlOrMeta && isShift && input.key.toLowerCase() === 'a' && input.type === 'keyDown') {
      event.preventDefault();
      void win.webContents.executeJavaScript(`
        window.location.hash = window.location.hash.includes('admin') ? '#/guest' : '#/admin';
      `);
    } else if (isControlOrMeta && isShift && input.key.toLowerCase() === 'q') {
      event.preventDefault();
      console.log('[OPERATOR_ESCAPE] Emergency app quit triggered by operator hotkey.');
      app.quit();
    } else if ((input.key === 'F12' || (isControlOrMeta && isShift && input.key.toLowerCase() === 'i')) && input.type === 'keyDown') {
      event.preventDefault();
      win.webContents.toggleDevTools();
    } else if (input.key === 'F11' && input.type === 'keyDown') {
      event.preventDefault();
      win.setFullScreen(!win.isFullScreen());
    } else if (isControlOrMeta && isShift && input.key.toLowerCase() === 'r') {
      event.preventDefault();
      win.reload();
    }
  });

  const target = isDev
    ? `${rendererUrl}/#/${mode}`
    : `${url.pathToFileURL(path.join(__dirname, '../../renderer/dist/index.html')).toString()}#/${mode}`;

  void win.loadURL(target);

  win.once('ready-to-show', () => {
    if (isKiosk) {
      // Kiosk: explicit bounds, fullscreen OS handles it
      win.setBounds({ x, y, width, height });
    } else {
      // Dev mode: maximize to fill the available screen area.
      // DO NOT use setBounds with outer dimensions — on Windows this causes
      // the content area to be smaller than intended (titlebar + borders eat into it).
      // win.maximize() fills the work area properly and CSS vh/vw will equal the
      // full available content size.
      win.maximize();
    }
    win.show();
    win.focus();
    const finalBounds = win.getBounds();
    const finalContentSize = win.getContentSize();
    console.log(`[DISPLAY_AUDIT] ELECTRON_GUEST_VISIBLE = YES (OuterBounds: ${JSON.stringify(finalBounds)}, ContentSize: ${JSON.stringify({ width: finalContentSize[0], height: finalContentSize[1] })})`);
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
let activeEventId = 'event_hoi_an_heritage';
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
  const vStatus = String(session.videoCompositionState || 'NONE').toUpperCase();
  if (vStatus === 'QUEUED' || vStatus === 'PROCESSING') {
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

const { PrintQueueManager } = require('./printer/print-queue-manager.cjs');

const printQueue = new PrintQueueManager({
  ensureStorageDb,
  storageRoot,
  sessionMediaPaths,
  sessions,
  writeSystemLog,
  checkAndCompleteSession,
});

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

  // Seed initial default events only if events table is completely empty
  try {
    const eventCount = adminDb.prepare('SELECT COUNT(*) AS count FROM events').get();
    if (!eventCount || eventCount.count === 0) {
      const now = nowIso();
      const initialEvents = [
        { eventId: 'event_hoi_an_heritage', name: 'Phố Cổ Hội An' },
        { eventId: 'event_wedding', name: 'Wedding • Tiệc Cưới' },
        { eventId: 'event_couple', name: 'Couple • Tình Yêu' },
      ];
      const insertStmt = adminDb.prepare(`
        INSERT OR IGNORE INTO events (event_id, name, status, created_at, updated_at)
        VALUES (?, ?, 'active', ?, ?)
      `);
      for (const item of initialEvents) {
        insertStmt.run(item.eventId, item.name, now, now);
      }
    }
  } catch {}

  adminDb.pragma('foreign_keys = ON');

  return adminDb;
}

function getDbEvents() {
  try {
    const db = ensureAdminDb();
    const rows = db.prepare(`
      SELECT 
        e.event_id AS eventId, 
        e.name, 
        e.status,
        (SELECT COUNT(*) FROM admin_frames f WHERE f.event_id = e.event_id) AS frameCount
      FROM events e 
      ORDER BY e.created_at ASC
    `).all();
    if (rows && rows.length > 0) {
      return rows;
    }
  } catch (e) {
    console.warn('[AdminEvents] Failed to read events from SQLite:', e);
  }
  return [{ eventId: 'event_hoi_an_heritage', name: 'Phố Cổ Hội An', status: 'active', frameCount: 0 }];
}

function createDbEvent(name) {
  const db = ensureAdminDb();
  const eventName = String(name || 'Event').trim();
  const rawSlug = eventName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const eventId = `event_${rawSlug || Date.now()}`;
  const now = nowIso();
  db.prepare(`
    INSERT INTO events (event_id, name, status, created_at, updated_at)
    VALUES (?, ?, 'active', ?, ?)
    ON CONFLICT(event_id) DO UPDATE SET name = excluded.name, status = 'active', updated_at = excluded.updated_at
  `).run(eventId, eventName, now, now);
  return { eventId, name: eventName, status: 'active', frameCount: 0 };
}

function renameDbEvent(eventId, name) {
  const db = ensureAdminDb();
  const id = String(eventId || '').trim();
  const eventName = String(name || '').trim();
  const now = nowIso();
  db.prepare('UPDATE events SET name = ?, updated_at = ? WHERE event_id = ?').run(eventName, now, id);
  const updated = db.prepare(`
    SELECT 
      e.event_id AS eventId, 
      e.name, 
      e.status,
      (SELECT COUNT(*) FROM admin_frames f WHERE f.event_id = e.event_id) AS frameCount
    FROM events e 
    WHERE e.event_id = ?
  `).get(id);
  return updated || { eventId: id, name: eventName, status: 'active', frameCount: 0 };
}

function setDbEventStatus(eventId, status) {
  const db = ensureAdminDb();
  const id = String(eventId || '').trim();
  const newStatus = status === 'archived' ? 'archived' : 'active';
  const now = nowIso();
  db.prepare('UPDATE events SET status = ?, updated_at = ? WHERE event_id = ?').run(newStatus, now, id);
  const updated = db.prepare(`
    SELECT 
      e.event_id AS eventId, 
      e.name, 
      e.status,
      (SELECT COUNT(*) FROM admin_frames f WHERE f.event_id = e.event_id) AS frameCount
    FROM events e 
    WHERE e.event_id = ?
  `).get(id);
  return updated || { eventId: id, name: id, status: newStatus, frameCount: 0 };
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
        if (!scopedEventId || !def.eventId || def.eventId === scopedEventId) {
          result.push(def);
        }
      } catch {
        // Skip invalid JSON
      }
    }
  } catch {
    // Ignore DB errors
  }
  const memoryFrames = Array.from(adminTemplates.values()).filter((frame) => !scopedEventId || !frame.eventId || frame.eventId === scopedEventId);
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
    // Ensure event exists in events table to satisfy foreign key constraint
    db.prepare(`
      INSERT OR IGNORE INTO events (event_id, name, status, created_at, updated_at)
      VALUES (?, ?, 'active', ?, ?)
    `).run(scopedEventId, scopedEventId.replace(/^event_/, '').replace(/_/g, ' ').toUpperCase(), now, now);

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
    console.warn('[AdminFrames] Failed to save frame to SQLite DB:', err);
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
    if (cleanEventId) {
      db.prepare('DELETE FROM admin_frames WHERE event_id = ?').run(cleanEventId);
    } else {
      db.prepare('DELETE FROM admin_frames').run();
    }
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
  const normalized = String(mimeType || '').toLowerCase();
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(normalized)) throw new Error(`Unsupported image MIME type: ${mimeType}`);
  return normalized;
}

function nowTimestamp() {
  return new Date().toISOString();
}

function registerSkeletonIpc() {

  ipcMain.handle('cameraos:admin:auth:unlock', (_event, passcode) => String(passcode || '') === (process.env.MOMENTAI_ADMIN_PASSCODE || '0000') ? ok({ token: `admin_${Date.now()}`, expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString() }) : unavailable('ADMIN_PASSCODE_INVALID'));
  ipcMain.handle('cameraos:admin:auth:lock', () => ok(undefined));
  ipcMain.handle('cameraos:admin:auth:verify', () => ok(undefined));
  // Platform info: exposes isDev to renderer safely via IPC
  ipcMain.handle('cameraos:platform:info', () => ({ isDev, version: app.getVersion() }));
  ipcMain.handle('cameraos:admin:events:list', () => safeGuest(() => getDbEvents()));
  ipcMain.handle('cameraos:admin:events:create', (_event, name) => safeGuest(() => createDbEvent(name)));
  ipcMain.handle('cameraos:admin:events:get-active', () => ok(activeEventId || 'event_hoi_an_heritage'));
  ipcMain.handle('cameraos:admin:events:set-active', (_event, eventId) => {
    const id = String(eventId || '');
    activeEventId = id;
    return ok({ eventId: id, active: true });
  });
  ipcMain.handle('cameraos:admin:events:archive', (_event, eventId) => safeGuest(() => setDbEventStatus(eventId, 'archived')));
  ipcMain.handle('cameraos:admin:events:set-status', (_event, eventId, status) => safeGuest(() => setDbEventStatus(eventId, status)));
  ipcMain.handle('cameraos:admin:events:rename', (_event, eventId, name) => safeGuest(() => renameDbEvent(eventId, name)));
  ipcMain.handle('cameraos:admin:templates:list', (_event, eventId) => safeGuest(() => listAdminTemplates(typeof eventId === 'string' ? eventId : undefined)));
  ipcMain.handle('cameraos:admin:templates:publish', (_event, templateId, eventId) => safeGuest(() => { setAdminTemplateStatus(templateId, eventId, 'published'); return undefined; }));
  ipcMain.handle('cameraos:admin:templates:archive', (_event, templateId, eventId) => safeGuest(() => { setAdminTemplateStatus(templateId, eventId, 'private'); return undefined; }));
  ipcMain.handle('cameraos:admin:templates:save', (_event, eventId, frame) => safeGuest(() => { saveAdminTemplate(String(eventId || 'event_hoi_an_heritage'), frame); return undefined; }));
  ipcMain.handle('cameraos:admin:templates:remove', (_event, eventId, templateId) => safeGuest(() => { removeAdminTemplate(String(eventId || ''), templateId); return undefined; }));
  ipcMain.handle('cameraos:admin:templates:clear', (_event, eventId) => safeGuest(() => { clearAdminTemplates(String(eventId || '')); return undefined; }));
  ipcMain.handle('cameraos:admin:health:snapshot', () => {
    const isCanonReady = canonRuntime.state === 'READY' || canonRuntime.state === 'LIVEVIEW' || canonRuntime.state === 'STARTING_LIVEVIEW' || canonRuntime.state === 'CAPTURING';
    const isCanonConnecting = canonRuntime.state === 'ENUMERATING' || canonRuntime.state === 'INITIALIZING' || canonRuntime.state === 'OPENING_SESSION' || canonRuntime.state === 'DISCOVERY_WAIT';
    const isCanonError = canonRuntime.state === 'ERROR' || canonRuntime.state === 'CAMERA_PTP_UNRESPONSIVE';

    let cameraStatus = 'ready';
    if (isCanonReady || canonRuntime.cameraCount > 0) {
      cameraStatus = 'ready';
    } else if (isCanonConnecting) {
      cameraStatus = 'busy';
    } else if (isCanonError) {
      cameraStatus = 'error';
    } else {
      cameraStatus = 'ready'; // Always ready or gracefully degraded
    }

    let printerStatus = 'ready';
    try {
      const qStatus = printQueue.getQueueStatus();
      if (qStatus.isPaused) printerStatus = 'paused';
      else if (qStatus.isProcessing) printerStatus = 'printing';
      else if (qStatus.consumables && qStatus.consumables.isLowPaper) printerStatus = 'degraded';
      else printerStatus = 'ready';
    } catch {
      printerStatus = 'ready';
    }

    return ok({
      camera: cameraStatus,
      printer: printerStatus,
      storage: 'ready',
      network: 'online',
      hardwareStatus: 'ready',
    });
  });
  ipcMain.handle('cameraos:admin:cleanup:summary', () => ok({ config: { enabled: true, retentionMinutes: 10, cleanupIntervalSeconds: 60, mode: 'audit_minimal', deferWhilePrintActive: true, printCleanupGraceMinutes: 30 }, pending: 0, eligible: 0, deleted: 0, failed: 0 }));
  ipcMain.handle('cameraos:admin:cleanup:run-now', () => ok([]));
  ipcMain.handle('cameraos:admin:printer:get-status', () => safeGuest(() => printQueue.getQueueStatus()));
  ipcMain.handle('cameraos:admin:printer:reset-paper', (_event, capacity) => safeGuest(() => printQueue.resetConsumables(capacity)));
  ipcMain.handle('cameraos:admin:printer:pause-queue', () => safeGuest(() => printQueue.pauseQueue()));
  ipcMain.handle('cameraos:admin:printer:resume-queue', () => safeGuest(() => printQueue.resumeQueue()));
  ipcMain.handle('cameraos:admin:printer:retry-job', (_event, jobId) => safeGuest(() => printQueue.retryJob(jobId)));
  ipcMain.handle('cameraos:admin:printer:cancel-job', (_event, jobId) => safeGuest(() => printQueue.cancelJob(jobId)));
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
  if (sessionMediaPaths) {
    sessionMediaPaths.ensureSessionDirectories(safeSessionId);
  } else {
    fs.mkdirSync(path.join(storageRoot, 'sessions', safeSessionId, 'photos'), { recursive: true });
    fs.mkdirSync(path.join(storageRoot, 'sessions', safeSessionId, 'clips'), { recursive: true });
    fs.mkdirSync(path.join(storageRoot, 'sessions', safeSessionId, 'outputs'), { recursive: true });
  }
  const now = nowIso();
  db.prepare('INSERT INTO sessions (session_id, created_at, updated_at, payload_json) VALUES (?, ?, ?, NULL) ON CONFLICT(session_id) DO UPDATE SET updated_at = excluded.updated_at').run(safeSessionId, now, now);
}

/**
 * Injects sRGB EXIF (ColorSpace=1, 600 DPI) into a JPEG Buffer.
 * Inserts APP1 AFTER existing APP0 (JFIF) segment and patches APP0 density to 600dpi.
 * This ensures Windows Explorer shows "Color representation: sRGB" on all output JPEGs.
 */
function injectSrgbExifIntoJpeg(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 4 || bytes[0] !== 0xFF || bytes[1] !== 0xD8) return bytes;

  // Build TIFF LE EXIF payload
  const tiff = Buffer.alloc(96, 0);
  let o = 0;
  tiff.writeUInt16LE(0x4949, o); o += 2; // 'II' LE
  tiff.writeUInt16LE(42,     o); o += 2; // TIFF magic
  tiff.writeUInt32LE(8,      o); o += 4; // IFD0 at offset 8
  tiff.writeUInt16LE(4,      o); o += 2; // IFD0: 4 entries
  // 0x011A XResolution → RATIONAL at 62
  tiff.writeUInt16LE(0x011A, o); o += 2; tiff.writeUInt16LE(5, o); o += 2; tiff.writeUInt32LE(1, o); o += 4; tiff.writeUInt32LE(62, o); o += 4;
  // 0x011B YResolution → RATIONAL at 70
  tiff.writeUInt16LE(0x011B, o); o += 2; tiff.writeUInt16LE(5, o); o += 2; tiff.writeUInt32LE(1, o); o += 4; tiff.writeUInt32LE(70, o); o += 4;
  // 0x0128 ResolutionUnit = 2 (inch)
  tiff.writeUInt16LE(0x0128, o); o += 2; tiff.writeUInt16LE(3, o); o += 2; tiff.writeUInt32LE(1, o); o += 4; tiff.writeUInt32LE(2, o); o += 4;
  // 0x8769 ExifIFD pointer → offset 78
  tiff.writeUInt16LE(0x8769, o); o += 2; tiff.writeUInt16LE(4, o); o += 2; tiff.writeUInt32LE(1, o); o += 4; tiff.writeUInt32LE(78, o); o += 4;
  tiff.writeUInt32LE(0, o); // next IFD0 = 0 (o=58)
  // Rational values
  tiff.writeUInt32LE(600, 62); tiff.writeUInt32LE(1, 66); // XRes = 600/1
  tiff.writeUInt32LE(600, 70); tiff.writeUInt32LE(1, 74); // YRes = 600/1
  // ExifIFD at offset 78: 1 entry — 0xA001 ColorSpace = 1 (sRGB)
  tiff.writeUInt16LE(1,      78);
  tiff.writeUInt16LE(0xA001, 80); tiff.writeUInt16LE(3, 82); tiff.writeUInt32LE(1, 84); tiff.writeUInt32LE(1, 88);
  tiff.writeUInt32LE(0, 92); // next ExifIFD = 0

  const exifPayload = Buffer.concat([Buffer.from([0x45, 0x78, 0x69, 0x66, 0x00, 0x00]), tiff]);
  const app1Len = exifPayload.length + 2;
  const app1 = Buffer.concat([Buffer.from([0xFF, 0xE1, (app1Len >> 8) & 0xFF, app1Len & 0xFF]), exifPayload]);

  let insertPos = 2;
  if (bytes[2] === 0xFF && bytes[3] === 0xE0 && bytes.length >= 6) {
    const app0Len = bytes.readUInt16BE(4);
    // Patch APP0 density to 600 dpi
    if (bytes.length >= 14) {
      bytes[8] = 1;                   // density unit = inch
      bytes.writeUInt16BE(600, 9);    // Xdensity = 600
      bytes.writeUInt16BE(600, 11);   // Ydensity = 600
    }
    insertPos = 2 + 2 + app0Len;
    if (insertPos > bytes.length) insertPos = bytes.length;
  }

  return Buffer.concat([bytes.subarray(0, insertPos), app1, bytes.subarray(insertPos)]);
}

function saveStorageFile(sessionId, relativePath, id, file, outputType, allowOverwrite) {
  const db = ensureStorageDb();
  const absolutePath = path.join(storageRoot, relativePath);
  if (!allowOverwrite && (fs.existsSync(absolutePath) || db.prepare('SELECT id FROM stored_files WHERE id = ?').get(id))) throw new Error('Original already exists and will not be overwritten.');
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  let bytes = binaryBytes(file?.bytes || file?.dataUrl || '');
  if (bytes.byteLength <= 0) throw new Error('Image bytes are empty.');
  // Inject sRGB EXIF into JPEG output files for correct color reproduction on CP1000
  const ext = path.extname(absolutePath).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') {
    bytes = injectSrgbExifIntoJpeg(bytes);
  }
  const tempPath = `${absolutePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tempPath, bytes);
  fs.renameSync(tempPath, absolutePath);
  const now = nowIso();
  console.log(`[PHOTO_UI_PATH_AUDIT]\nshotIndex=${outputType ? 'output' : id}\nphysicalPath=${absolutePath}\nrendererUrl=${relativePath}\nphysicalFileExists=${fs.existsSync(absolutePath)}\nsameCanonicalSession=true`);
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

function writeSessionManifestAndMetadata(sessionId) {
  try {
    if (!sessionMediaPaths) return;
    const session = sessions.get(sessionId);
    const clips = desktopMediaManager.getClips(sessionId) || [];
    const requiredShots = session?.captureCount || session?.photos?.length || 4;

    const existingPhotos = [];
    for (let i = 1; i <= requiredShots; i++) {
      const p = sessionMediaPaths.photo(sessionId, i);
      if (fs.existsSync(p)) {
        existingPhotos.push({
          shotIndex: i,
          path: `photos/shot_${String(i).padStart(2, '0')}.jpg`,
        });
      }
    }

    const existingClips = [];
    for (let i = 1; i <= requiredShots; i++) {
      const c = sessionMediaPaths.clip(sessionId, i);
      if (fs.existsSync(c)) {
        existingClips.push({
          shotIndex: i,
          path: `clips/shot_${String(i).padStart(2, '0')}.mp4`,
        });
      }
    }

    const finalImagePath = sessionMediaPaths.finalImage(sessionId);
    const finalVideoPath = sessionMediaPaths.finalVideo(sessionId);

    const manifestData = {
      sessionId,
      provider: canonRuntime.cameraModel ? 'canon' : 'device',
      cameraModel: canonRuntime.cameraModel || 'Canon EOS 6D',
      product: session?.product?.id || 'classic_4_shot',
      requiredShots,
      photos: existingPhotos,
      clips: existingClips,
      outputs: {
        ...(fs.existsSync(finalImagePath) ? { finalImage: 'outputs/final-image.jpg' } : {}),
        ...(fs.existsSync(finalVideoPath) ? { finalVideo: 'outputs/final-video.mp4' } : {}),
      },
      createdAt: session?.createdAt || nowIso(),
      completedAt: session?.completedAt || nowIso(),
    };
    fs.writeFileSync(sessionMediaPaths.manifest(sessionId), JSON.stringify(manifestData, null, 2));

    const metaData = {
      provider: canonRuntime.cameraModel ? 'canon' : 'device',
      cameraModel: canonRuntime.cameraModel || 'Canon EOS 6D',
      createdAt: session?.createdAt || nowIso(),
      completedAt: session?.completedAt || nowIso(),
      productType: session?.product?.id || 'classic_4_shot',
      requiredShots,
      photoCount: existingPhotos.length,
      clipCount: existingClips.length,
      finalImage: fs.existsSync(finalImagePath) ? { width: 1800, height: 2700 } : null,
      finalVideo: fs.existsSync(finalVideoPath) ? { durationMs: 4000 } : null,
    };
    fs.writeFileSync(sessionMediaPaths.metadata(sessionId), JSON.stringify(metaData, null, 2));
  } catch (e) {
    console.warn('[SessionManifest] Failed to write manifest/metadata:', e);
  }
}




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
    const relativePath = path.posix.join('sessions', safeSessionId, 'photos', `shot_${String(safeShotIndex).padStart(2, '0')}${extensionForMime(mimeType)}`);
    return saveStorageFile(safeSessionId, relativePath, `original_${safeSessionId}_${safeShotIndex}`, { ...photo, mimeType }, undefined, false);
  }));
  ipcMain.handle('cameraos:storage:output:save', (_event, sessionId, type, file) => safeGuest(() => {
    const safeSessionId = assertStorageId(sessionId, 'session id');
    const outputType = assertOutputTypeValue(type);
    createStorageSession(safeSessionId);
    const mimeType = assertImageMime(file?.mimeType || 'image/jpeg');
    let filename = `${outputType}${extensionForMime(mimeType)}`;
    if (outputType === 'share' || type === 'final-image') {
      filename = 'final-image.jpg';
    } else if (outputType === 'print' || type === 'print-cp1000') {
      filename = 'print-cp1000.jpg';
    }
    const relativePath = path.posix.join('sessions', safeSessionId, 'outputs', filename);
    const stored = saveStorageFile(safeSessionId, relativePath, `output_${safeSessionId}_${outputType}`, { ...file, mimeType }, outputType, true);

    writeSessionManifestAndMetadata(safeSessionId);
    cloudSyncCoordinator.onOutputSaved(safeSessionId, outputType, relativePath);

    return stored;
  }));

  ipcMain.handle('cameraos:camera:status', () => safeGuest(() => {
    logCameraRuntimeStatus('IPC_STATUS_QUERY');

    if (canonRuntime.state === STATES.READY || canonRuntime.state === STATES.LIVEVIEW) {
      return {
        provider: 'canon',
        preferredProvider: 'canon',
        fallbackActive: false,
        fallbackEligible: false,
        liveView: true,
        stillCapture: true,
        hardwareStatus: 'ready',
        model: canonRuntime.cameraModel || 'Canon EOS 6D',
        state: canonRuntime.state,
      };
    }

    if (
      canonRuntime.state === STATES.ENUMERATING ||
      canonRuntime.state === STATES.DISCOVERY_WAIT ||
      canonRuntime.state === STATES.INITIALIZING ||
      canonRuntime.state === STATES.OPENING_SESSION ||
      canonRuntime.state === STATES.CONFIGURING ||
      canonRuntime.state === STATES.STARTING_LIVEVIEW ||
      canonRuntime.state === STATES.RESUMING_LIVEVIEW ||
      (canonRuntime.cameraCount > 0 && canonRuntime.state !== STATES.DISCONNECTED && canonRuntime.state !== STATES.ERROR)
    ) {
      return {
        provider: 'canon',
        preferredProvider: 'canon',
        fallbackActive: false,
        fallbackEligible: false,
        liveView: false,
        stillCapture: false,
        hardwareStatus: 'connecting',
        model: canonRuntime.cameraModel || 'Canon EOS 6D',
        state: canonRuntime.state,
      };
    }

    if (canonRuntime.state === STATES.CAMERA_NOT_FOUND) {
      return {
        provider: 'canon',
        preferredProvider: 'canon',
        fallbackActive: false,
        fallbackEligible: true,
        hardwareStatus: 'error',
        error: 'CAMERA_NOT_FOUND',
        model: canonRuntime.cameraModel || 'Canon EOS 6D',
        state: canonRuntime.state,
      };
    }

    if (canonRuntime.state === STATES.ERROR) {
      return {
        provider: 'canon',
        preferredProvider: 'canon',
        fallbackActive: false,
        fallbackEligible: true,
        hardwareStatus: 'error',
        error: 'CANON_SESSION_FAILED',
        model: canonRuntime.cameraModel || 'Canon EOS 6D',
        state: canonRuntime.state,
      };
    }

    writeCanonShadowLog('GetDeviceInformation', { reason: 'mac-device-camera-development-status' });
    return {
      provider: 'mac-device-camera',
      preferredProvider: 'canon',
      fallbackActive: true,
      fallbackEligible: true,
      fallbackReason: 'NO_CANON_HARDWARE',
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
    const isLastShot = Boolean(context?.isLastShot);
    const correlationId = typeof context?.correlationId === 'string' ? context.correlationId : `canon_${Date.now()}_${shotIndex}`;

    activeCaptureSessionId = sessionId;
    activeCaptureShotIndex = shotIndex;

    const validStates = ['READY', 'LIVEVIEW', 'STARTING_LIVEVIEW', 'RESUMING_LIVEVIEW'];
    if (validStates.includes(canonRuntime.state)) {
      const sessionDir = sessionMediaPaths ? sessionMediaPaths.photosDir(sessionId) : path.join(storageRoot, 'sessions', sessionId, 'photos');
      fs.mkdirSync(sessionDir, { recursive: true });
      const targetPath = sessionMediaPaths ? sessionMediaPaths.photo(sessionId, shotIndex, '.jpg') : path.join(sessionDir, `shot_${String(shotIndex).padStart(2, '0')}.jpg`);

      const result = await canonRuntime.capture({
        sessionId,
        shotIndex,
        targetPath,
        correlationId,
        isLastShot,
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
          photoId: `canon_photo_${Date.now()}_${shotIndex}`,
          sessionId,
          shotIndex,
          localPath: result.path,
          originalPath: result.path,
          dataUrl,
          width: result.width || 5472,
          height: result.height || 3648,
          size: result.size,
          provider: 'canon',
          mimeType: 'image/jpeg',
        },
      };
    }

    if (canonRuntime.cameraCount > 0 || canonRuntime.state !== 'DISCONNECTED') {
      throw new Error(`Canon EOS 6D not ready for capture (current state: ${canonRuntime.state})`);
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

  ipcMain.handle('cameraos:camera:autofocus', async (_event, context) => safeGuest(async () => {
    const sessionId = typeof context?.sessionId === 'string' ? context.sessionId : 'unknown_session';
    const shotIndex = Number.isFinite(Number(context?.shotIndex)) ? Number(context.shotIndex) : activeCaptureShotIndex;
    const correlationId = typeof context?.correlationId === 'string' ? context.correlationId : `af_${Date.now()}_${shotIndex}`;

    if (canonRuntime.state === 'READY' || canonRuntime.state === 'LIVEVIEW' || canonRuntime.state === 'STARTING_LIVEVIEW') {
      try {
        const afStart = new Date().toISOString();
        const res = await canonRuntime.autoFocus({ sessionId, shotIndex, correlationId, timeoutMs: 1500 });
        const afEnd = new Date().toISOString();
        if (desktopMediaManager) {
          desktopMediaManager.markAutofocus(sessionId, shotIndex - 1, afStart, afEnd);
        }
        return { ok: res?.ok ?? true, provider: 'canon', status: 'focused', correlationId, ...res };
      } catch (err) {
        console.warn('[Main] Canon autoFocus error:', err.message);
        return { ok: false, provider: 'canon', status: 'failed', error: err.message, correlationId };
      }
    }

    writeCanonShadowLog('DoEvfAF', { sessionId, correlationId, mode: 'AI SERVO', status: 'focused' });
    return { ok: true, provider: 'canon-shadow', status: 'focused', correlationId };
  }));

  ipcMain.handle('cameraos:camera:liveview:start', async (_event, context) => safeGuest(async () => {
    liveViewRequested = true;
    if (context?.sessionId) {
      activeCaptureSessionId = String(context.sessionId);
    }
    const res = await canonRuntime.startLiveView();
    return { provider: 'canon', liveViewRunning: res };
  }));

  ipcMain.handle('cameraos:camera:liveview:stop', async (_event, _context) => safeGuest(async () => {
    // Preserve physical LiveView warm in background across normal Guest flow
    return { provider: 'canon', liveViewRunning: true };
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
    activeCaptureSessionId = session.sessionId;
    activeCaptureShotIndex = 1;
    sessions.set(session.sessionId, session);
    if (sessionMediaPaths) {
      sessionMediaPaths.ensureSessionDirectories(session.sessionId);
      console.log(`[SESSION_STORAGE_CREATED]\nsessionId=${session.sessionId}\nsessionRoot=${sessionMediaPaths.sessionRoot(session.sessionId)}\nphotosDir=${sessionMediaPaths.photosDir(session.sessionId)}\nclipsDir=${sessionMediaPaths.clipsDir(session.sessionId)}\noutputsDir=${sessionMediaPaths.outputsDir(session.sessionId)}\nmanifestPath=${sessionMediaPaths.manifest(session.sessionId)}\nmetadataPath=${sessionMediaPaths.metadata(session.sessionId)}`);
    }
    return session;
  }));
  ipcMain.handle('cameraos:guest:session:get', (_event, sessionId) => safeGuest(() => sessions.get(String(sessionId || '')) || null));
  ipcMain.handle('cameraos:guest:capture-formats:list', () => ok(listEnabledCaptureFormats()));
  ipcMain.handle('cameraos:guest:format:select', (_event, sessionId, formatId) => safeGuest(() => {
    const session = requireGuestSession(String(sessionId || ''));
    const captureFormat = listEnabledCaptureFormats().find((format) => format.id === String(formatId || ''));
    if (!captureFormat) throw new Error('Invalid capture format.');
    activeCaptureSessionId = session.sessionId;
    activeCaptureShotIndex = 1;
    return touch({ ...session, captureFormat, photos: [], selectedTemplate: null, slotAssignments: [], outputs: { master: null, share: null, print: null } }, 'READY_TO_CAPTURE');
  }));
  ipcMain.handle('cameraos:guest:photo:add', (_event, sessionId, photo) => safeGuest(() => {
    const session = requireGuestSession(String(sessionId || ''));
    if (!session.captureFormat) throw new Error('Capture format is required before capture.');
    const shotIndex = Number(photo?.shotIndex || (session.photos.length + 1));
    const photoId = String(photo?.photoId || photo?.id || `photo_${Date.now()}_${shotIndex}`);
    const resolvedPath = photo?.localPath || (sessionMediaPaths ? sessionMediaPaths.photo(session.sessionId, shotIndex) : path.join(storageRoot, 'sessions', session.sessionId, 'photos', `shot_${String(shotIndex).padStart(2, '0')}.jpg`));
    const nextPhoto = {
      photoId,
      id: photoId,
      sessionId: session.sessionId,
      shotIndex,
      originalPath: resolvedPath,
      localPath: resolvedPath,
      status: 'valid',
      capturedAt: nowIso(),
      dataUrl: typeof photo?.dataUrl === 'string' ? photo.dataUrl : undefined,
      width: photo?.width || 5472,
      height: photo?.height || 3648,
      size: photo?.size,
      provider: photo?.provider || 'canon',
      mimeType: photo?.mimeType || 'image/jpeg',
    };
    const photos = [...session.photos.filter((existing) => existing.shotIndex !== shotIndex), nextPhoto].sort((a, b) => a.shotIndex - b.shotIndex);
    const nextStatus = photos.filter((item) => item.status === 'valid').length >= session.captureFormat.shotCount ? 'SELECTING_TEMPLATE' : 'CAPTURING';
    activeCaptureShotIndex = Math.min(photos.length + 1, session.captureFormat.shotCount);
    const updated = touch({ ...session, photos }, nextStatus);

    // Save session manifest to disk
    try {
      if (sessionMediaPaths) {
        const manifestData = {
          sessionId: session.sessionId,
          photos: updated.photos,
          clips: desktopMediaManager.getClips(session.sessionId) || [],
          outputs: {
            finalImage: sessionMediaPaths.finalImage(session.sessionId),
            finalVideo: sessionMediaPaths.finalVideo(session.sessionId),
          },
          updatedAt: nowIso(),
        };
        fs.writeFileSync(sessionMediaPaths.manifest(session.sessionId), JSON.stringify(manifestData, null, 2));
      }
    } catch (e) {}

    return ok(updated);
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
    const finalImgPath = sessionMediaPaths ? sessionMediaPaths.finalImage(session.sessionId) : path.join(storageRoot, 'sessions', session.sessionId, 'outputs', 'final-image.jpg');
    const printImgPath = sessionMediaPaths ? sessionMediaPaths.printMaster(session.sessionId) : path.join(storageRoot, 'sessions', session.sessionId, 'outputs', 'print-cp1000.jpg');
    const masterImgPath = path.join(storageRoot, 'sessions', session.sessionId, 'outputs', 'master.png');
    return touch({ ...session, outputs: { master: masterImgPath, share: finalImgPath, print: printImgPath }, qr: { url: '', status: 'failed' } }, 'RESULT_READY');
  }));
  ipcMain.handle('cameraos:guest:print:request', (_event, sessionId, copies) => safeGuest(() => {
    let session = sessions.get(String(sessionId || ''));
    if (!session) {
      const sid = String(sessionId || '');
      const diskPrintImg = sessionMediaPaths ? sessionMediaPaths.printMaster(sid) : path.join(storageRoot, 'sessions', sid, 'outputs', 'print-cp1000.jpg');
      if (fs.existsSync(diskPrintImg)) {
        session = {
          sessionId: sid,
          eventId: 'CALIBRATION',
          status: 'COMPOSING',
          product: { id: 'PREMIUM_POSTCARD', printSheets: 1 },
          captureFormat: { id: 'SHEET_4' },
          photos: [],
          outputs: { print: diskPrintImg },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        sessions.set(sid, session);
      } else {
        throw new Error(`Session not found: ${sid}`);
      }
    }
    const printImg =
      session.outputs?.print ||
      (sessionMediaPaths ? sessionMediaPaths.printMaster(session.sessionId) : null) ||
      path.join(storageRoot, 'sessions', session.sessionId, 'outputs', 'print-cp1000.jpg');
    const fallbackImg = sessionMediaPaths ? sessionMediaPaths.finalImage(session.sessionId) : path.join(storageRoot, 'sessions', session.sessionId, 'outputs', 'final-image.jpg');
    const targetImg = fs.existsSync(printImg) ? printImg : fallbackImg;
    const exists = fs.existsSync(targetImg);
    const size = exists ? fs.statSync(targetImg).size : 0;
    console.log(`[PRINT_MEDIA_AUDIT]\nsessionId=${session.sessionId}\ninputPath=${targetImg}\nrealPath=${exists ? fs.realpathSync(targetImg) : targetImg}\nexists=${exists}\nsize=${size}`);
    const enqueueResult = printQueue.enqueue(session, { copies: Number(copies) || 1, printMasterPath: targetImg });
    if (!enqueueResult.ok) {
      throw new Error(enqueueResult.error?.message || 'Print enqueue failed.');
    }
    return touch({ ...session, printJob: enqueueResult.value }, session.status);
  }));
  // Returns the real-time print job status for a session (used by renderer polling)
  ipcMain.handle('cameraos:printer:status', (_event, sessionId) => safeGuest(() => {
    if (!sessionId) {
      return { connected: false, status: 'UNKNOWN', jobStatus: null };
    }
    const session = sessions.get(String(sessionId));
    const jobId = session?.printJob?.id;
    let jobStatus = null;
    if (jobId) {
      try {
        const db = ensureStorageDb();
        const row = db.prepare('SELECT status, last_error, attempt_count, completed_at FROM print_jobs WHERE id = ?').get(jobId);
        if (row) {
          jobStatus = {
            jobId,
            status: String(row.status || 'UNKNOWN').toUpperCase(),
            lastError: row.last_error || null,
            attemptCount: row.attempt_count || 0,
            completedAt: row.completed_at || null,
          };
        }
      } catch {
        // Ignore DB errors
      }
    }
    return {
      connected: true,
      status: jobStatus?.status || 'UNKNOWN',
      jobStatus,
    };
  }));
  ipcMain.handle('cameraos:media:clip-recorder:start-shot', (_event, sessionId, shotIndex, countdownStartedAt) => safeGuest(() => {
    activeCaptureSessionId = sessionId;
    activeCaptureShotIndex = Number(shotIndex) + 1;
    const session = sessions.get(String(sessionId || ''));
    const requiredShots = session?.captureFormat?.shotCount || session?.product?.requiredShots || 4;
    return desktopMediaManager.startShotClip(sessionId, shotIndex, countdownStartedAt, { requiredShots });
  }));
  ipcMain.handle('cameraos:media:clip-recorder:push-device-frame', (_event, sessionId, shotIndex, bufferData, width, height) => safeGuest(() => {
    const buf = Buffer.isBuffer(bufferData) ? bufferData : Buffer.from(bufferData);
    desktopMediaManager.pushDevicePreviewFrame(sessionId, shotIndex, buf, width, height);
    return { ok: true };
  }));
  ipcMain.handle('cameraos:media:clip-recorder:mark-shutter', (_event, sessionId, shotIndex, shutterAt) => safeGuest(() => {
    return desktopMediaManager.markShutter(sessionId, shotIndex, shutterAt);
  }));
  ipcMain.handle('cameraos:media:clip-recorder:stop-shot', (_event, sessionId, shotIndex, persistedAt, options) => safeGuest(async () => {
    let fallbackBuf = null;
    if (options?.fallbackDataUrl) {
      const b64 = options.fallbackDataUrl.split(',').pop() || '';
      fallbackBuf = Buffer.from(b64, 'base64');
    }
    return desktopMediaManager.stopShotClip(sessionId, shotIndex, persistedAt, { fallbackImageBuffer: fallbackBuf });
  }));
  ipcMain.handle('cameraos:media:clip-recorder:fail-shot', (_event, sessionId, shotIndex, error) => safeGuest(() => {
    return desktopMediaManager.failShotClip(sessionId, shotIndex, error);
  }));
  ipcMain.handle('cameraos:media:clip-recorder:get-clips', (_event, sessionId) => safeGuest(() => {
    return desktopMediaManager.getClips(sessionId);
  }));
  ipcMain.handle('cameraos:media:video:compose', (_event, sessionId, frame, options) => safeGuest(() => {
    const session = requireGuestSession(String(sessionId || ''));
    session.videoCompositionState = 'QUEUED';
    sessions.set(sessionId, session);
    const job = desktopMediaManager.enqueueMediaJob(sessionId, 'FRAME_VIDEO_COMPOSE', {
      frame,
      overlayUrl: options?.overlayUrl,
      drawDataUrl: options?.drawDataUrl,
      durationMs: options?.durationMs || 4000,
      targetWidth: options?.targetWidth,
      targetHeight: options?.targetHeight,
    });
    return ok(job);
  }));
  ipcMain.handle('cameraos:media:package:get', (_event, sessionId, origin) => safeGuest(() => {
    return desktopMediaManager.getSessionMediaPackage(sessionId, origin);
  }));
  ipcMain.handle('cameraos:media:token:get', (_event, sessionId) => safeGuest(() => {
    return { publicToken: desktopMediaManager.getPublicToken(sessionId) };
  }));
  ipcMain.handle('cameraos:guest:complete', (_event, sessionId) => safeGuest(() => {
    const session = requireGuestSession(String(sessionId || ''));
    const now = nowIso();
    const updated = touch({ ...session, completedAt: now }, 'COMPLETED');
    activeCaptureSessionId = null;
    writeSessionManifestAndMetadata(session.sessionId);
    checkAndCompleteSession(session.sessionId);
    return ok(updated);
  }));

  // Cloud Synchronization IPC
  ipcMain.handle('cameraos:cloud:session:init', (_event, sessionId, metadata) => safeGuest(() => {
    const safeId = assertStorageId(sessionId, 'session id');
    return cloudSyncCoordinator.initSession(safeId, metadata);
  }));
  ipcMain.handle('cameraos:cloud:session:get-token', (_event, sessionId) => safeGuest(() => {
    const safeId = assertStorageId(sessionId, 'session id');
    return {
      publicToken: cloudSyncCoordinator.getPublicToken(safeId),
      landingUrl: cloudSyncCoordinator.getLandingUrl(safeId),
    };
  }));
  ipcMain.handle('cameraos:cloud:upload:phase-a', (_event, sessionId) => safeGuest(() => {
    const safeId = assertStorageId(sessionId, 'session id');
    void cloudSyncCoordinator.triggerPhaseAUpload(safeId);
    return { ok: true, triggered: true };
  }));
  ipcMain.handle('cameraos:cloud:session:get-status', (_event, sessionId) => safeGuest(() => {
    const safeId = assertStorageId(sessionId, 'session id');
    const state = cloudSyncCoordinator.sessions.get(safeId);
    return state || null;
  }));

let lastFrameBroadcast = 0;
let lastEvfFrameAt = 0;
let lastEvfSeq = 0;
let liveViewRequested = false;
let activeCaptureSessionId = null;
let activeCaptureShotIndex = 1;

canonRuntime.on('liveViewFrame', (frame) => {
  lastEvfFrameAt = Date.now();
  lastEvfSeq = frame.seq || lastEvfSeq + 1;
  desktopMediaManager.pushCanonLiveViewFrame(frame);
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

let stallRecoveryInFlight = false;

async function handleLiveViewStall() {
  if (stallRecoveryInFlight) return;
  stallRecoveryInFlight = true;
  console.log('[CANON_HEALTH] LIVEVIEW_STALLED detected. Starting escalation recovery...');

  try {
    // LEVEL 1: In-Session EVF Recovery
    const l1Ok = await canonRuntime.recoverLiveViewLevel1();
    if (l1Ok) {
      console.log('[CANON_HEALTH] Level 1 EVF Recovery SUCCESSFUL.');
      return;
    }

    // LEVEL 2: Session Recovery (same bridge)
    console.warn('[CANON_HEALTH] Level 1 failed. Escalating to Level 2 (Session Recovery)...');
    const l2Ok = await canonRuntime.recoverSessionLevel2();
    if (l2Ok) {
      console.log('[CANON_HEALTH] Level 2 Session Recovery SUCCESSFUL.');
      return;
    }

    // LEVEL 3: Bridge Recovery (Process Respawn)
    console.warn('[CANON_HEALTH] Level 2 failed. Escalating to Level 3 (Bridge Process Respawn)...');
    const l3Ok = await canonRuntime.recoverBridgeLevel3();
    if (l3Ok) {
      console.log('[CANON_HEALTH] Level 3 Bridge Recovery SUCCESSFUL.');
      return;
    }
    console.error('[CANON_HEALTH] All 3 recovery levels exhausted. Camera in error state.');
  } catch (err) {
    console.error('[CANON_HEALTH] Recovery error:', err.message);
  } finally {
    stallRecoveryInFlight = false;
  }
}

// 3-Second Camera Health Monitor (Section 8 & 9)
setInterval(() => {
  const evfAgeMs = lastEvfFrameAt > 0 ? Date.now() - lastEvfFrameAt : 0;
  const runtimeAlive = Boolean(canonRuntime.process && !canonRuntime.process.killed);
  const bridgeAlive = Boolean(canonRuntime.state !== 'DISCONNECTED' && canonRuntime.state !== 'ERROR' && canonRuntime.state !== 'CAMERA_NOT_FOUND' && canonRuntime.state !== 'CAMERA_PTP_UNRESPONSIVE');
  const sessionOpen = canonRuntime.state === 'READY' || canonRuntime.state === 'LIVEVIEW' || canonRuntime.state === 'STARTING_LIVEVIEW' || canonRuntime.state === 'CAPTURING' || canonRuntime.state === 'DOWNLOADING';
  const usbPresent = Boolean(canonRuntime.physicalUsbPresent || canonRuntime.cameraCount > 0 || sessionOpen);
  const state = canonRuntime.state;
  const isStalled = liveViewRequested && evfAgeMs > 3000;

  const currentSessionId = activeCaptureSessionId || 'GUEST_STANDBY';
  const session = activeCaptureSessionId ? sessions.get(activeCaptureSessionId) : null;
  const photoCount = session?.photos?.length || 0;
  const clips = activeCaptureSessionId ? desktopMediaManager.getClips(activeCaptureSessionId) : [];
  const clipCount = clips?.filter((c) => c.status === 'ready')?.length || 0;
  const isClipRecording = clips?.some((c) => c.status === 'recording') || false;

  console.log(`[CANON_HEALTH] session=${currentSessionId} shot=${activeCaptureShotIndex}/4 runtimeAlive=${runtimeAlive} bridgeAlive=${bridgeAlive} usbPresent=${usbPresent} sessionOpen=${sessionOpen} state=${state}${isStalled ? ' (LIVEVIEW_STALLED)' : ''} evfAgeMs=${evfAgeMs} evfSeq=${lastEvfSeq} captureInProgress=${state === 'CAPTURING'} clipRecording=${isClipRecording} photoCount=${photoCount} clipCount=${clipCount}`);

  if (isStalled && (sessionOpen || state === 'LIVEVIEW_STALLED') && (state === 'LIVEVIEW' || state === 'READY' || state === 'LIVEVIEW_STALLED') && !isClipRecording && state !== 'CAPTURING' && state !== 'DOWNLOADING') {
    void handleLiveViewStall();
  }
}, 3000);

canonRuntime.on('error', (err) => {
  writeSystemLog('warn', 'CANON:RUNTIME_ERROR', typeof err === 'object' ? JSON.stringify(err) : String(err));
});

canonRuntime.on('bridgeError', (err) => {
  writeSystemLog('warn', 'CANON:BRIDGE_ERROR', typeof err === 'object' ? JSON.stringify(err) : String(err));
});

app.whenReady().then(async () => {
  console.log(`[ELECTRON_OWNER]\nelectronPid = ${process.pid}`);
  writeSystemLog('info', 'WINDOWMINI:BOOT', 'MomentAI CameraOS Electron Main booted.');
  registerSkeletonIpc();
  printQueue.init();
  ensureStorageDb();
  desktopMediaManager.init(storageDb);
  cloudSyncCoordinator.init(storageDb, sessionMediaPaths, desktopMediaManager);
  desktopMediaManager.onJobCompleted((job) => {
    const session = sessions.get(job.sessionId);
    if (session && job.jobType === 'FRAME_VIDEO_COMPOSE') {
      session.videoCompositionState = job.status === 'COMPLETED' ? 'COMPLETED' : 'FAILED';
      sessions.set(job.sessionId, session);
    }
    writeSessionManifestAndMetadata(job.sessionId);
    checkAndCompleteSession(job.sessionId);
    cloudSyncCoordinator.onJobCompleted(job);
  });
  initSessionCleanupScheduler();
  createWindow('guest');

  try {
    const canonOk = await canonRuntime.start();
    if (canonOk && (canonRuntime.state === 'READY' || canonRuntime.state === 'LIVEVIEW')) {
      desktopMediaManager.setProvider('canon');
      writeSystemLog('info', 'CANON:CONNECTED', `Canon camera ${canonRuntime.cameraModel} connected and ready.`);
    } else if (canonRuntime.cameraCount > 0) {
      desktopMediaManager.setProvider('canon');
      writeSystemLog('info', 'CANON:CONNECTING', `Canon camera ${canonRuntime.cameraModel} detected; session opening/connecting.`);
    } else {
      desktopMediaManager.setProvider('device');
      writeSystemLog('info', 'CANON:FALLBACK', 'Canon not detected on boot; falling back to device camera.');
    }
  } catch (err) {
    if (canonRuntime.cameraCount > 0) {
      desktopMediaManager.setProvider('canon');
      writeSystemLog('warn', 'CANON:START_WARNING', `Canon connecting warning: ${err.message}`);
    } else {
      desktopMediaManager.setProvider('device');
      writeSystemLog('warn', 'CANON:START_ERROR', `Canon start error: ${err.message}`);
    }
  }

  logCameraRuntimeStatus('POST_BOOT_AUDIT');

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow('guest');
  });
});

let isAppQuitting = false;

async function cleanupAndQuit() {
  if (isAppQuitting) return;
  isAppQuitting = true;
  console.log('[ELECTRON_CLEANUP] Releasing all Canon resources and shutting down runtime...');
  try {
    await canonRuntime.shutdown();
  } catch (err) {
    console.warn('[ELECTRON_CLEANUP] Error during canonRuntime.shutdown():', err);
  }
}

app.on('before-quit', async (event) => {
  if (!isAppQuitting) {
    event.preventDefault();
    await cleanupAndQuit();
    app.exit(0);
  }
});

app.on('window-all-closed', async () => {
  await cleanupAndQuit();
  app.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[ELECTRON_PROCESS] SIGINT received, cleaning up...');
  await cleanupAndQuit();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('[ELECTRON_PROCESS] SIGTERM received, cleaning up...');
  await cleanupAndQuit();
  process.exit(0);
});

process.on('exit', () => {
  try {
    canonRuntime.killSync();
  } catch (e) {}
});
