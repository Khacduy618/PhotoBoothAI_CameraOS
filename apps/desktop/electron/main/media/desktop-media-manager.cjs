/**
 * desktop-media-manager.cjs
 *
 * Authoritative Desktop Media Manager for MomentAI CameraOS Electron Main.
 * Manages:
 *  1. Per-shot countdown video clip recording from Canon EDSDK EVF / Device preview
 *  2. Video encoding via FFmpeg child processes
 *  3. Frame video composition: strict clip[i] -> slot[i], simultaneous playback, PNG overlay on top
 *  4. Durable SQLite media job queue & SessionMediaPackage
 */

const { spawn, execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { promisify } = require('util');
const crypto = require('crypto');

const execFileAsync = promisify(execFile);

function findBinary(name, fallbackPaths) {
  for (const p of fallbackPaths) {
    if (fs.existsSync(p)) return p;
  }
  return name;
}

const ffmpegPath = findBinary('ffmpeg', ['/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg', '/usr/bin/ffmpeg']);
const ffprobePath = findBinary('ffprobe', ['/opt/homebrew/bin/ffprobe', '/usr/local/bin/ffprobe', '/usr/bin/ffprobe']);

function normalizeSlotToPixels(slot, frameWidth, frameHeight) {
  const fw = frameWidth > 0 ? frameWidth : 1800;
  const fh = frameHeight > 0 ? frameHeight : 2700;

  const isUnitInterval =
    slot.width <= 1.0001 &&
    slot.height <= 1.0001 &&
    slot.x <= 1.0001 &&
    slot.y <= 1.0001;

  const isPercent =
    !isUnitInterval &&
    slot.width <= 100.0001 &&
    slot.height <= 100.0001 &&
    slot.x <= 100.0001 &&
    slot.y <= 100.0001;

  let xPx, yPx, wPx, hPx;
  if (isUnitInterval) {
    xPx = slot.x * fw;
    yPx = slot.y * fh;
    wPx = slot.width * fw;
    hPx = slot.height * fh;
  } else if (isPercent) {
    xPx = (slot.x / 100) * fw;
    yPx = (slot.y / 100) * fh;
    wPx = (slot.width / 100) * fw;
    hPx = (slot.height / 100) * fh;
  } else {
    xPx = slot.x;
    yPx = slot.y;
    wPx = slot.width;
    hPx = slot.height;
  }

  return {
    x: Math.round(xPx * 100) / 100,
    y: Math.round(yPx * 100) / 100,
    width: Math.round(wPx * 100) / 100,
    height: Math.round(hPx * 100) / 100,
  };
}

function calculateSourceCropRect(sourceW, sourceH, slotW, slotH) {
  const srcW = sourceW > 0 ? sourceW : 1920;
  const srcH = sourceH > 0 ? sourceH : 1080;
  const dstW = slotW > 0 ? slotW : 1;
  const dstH = slotH > 0 ? slotH : 1;

  const sourceAspect = srcW / srcH;
  const slotAspect = dstW / dstH;

  let cropX, cropY, cropW, cropH;

  if (sourceAspect > slotAspect) {
    cropH = srcH;
    cropW = srcH * slotAspect;
    cropX = (srcW - cropW) / 2; // center
    cropY = 0;
  } else {
    cropW = srcW;
    cropH = srcW / slotAspect;
    cropX = 0;
    cropY = srcH - cropH; // bottom
  }

  cropX = Math.max(0, Math.min(cropX, srcW - 1));
  cropY = Math.max(0, Math.min(cropY, srcH - 1));
  cropW = Math.max(1, Math.min(cropW, srcW - cropX));
  cropH = Math.max(1, Math.min(cropH, srcH - cropY));

  return {
    cropX: Math.round(cropX * 100) / 100,
    cropY: Math.round(cropY * 100) / 100,
    cropW: Math.round(cropW * 100) / 100,
    cropH: Math.round(cropH * 100) / 100,
  };
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg error (exit code ${code}): ${stderr.slice(-400)}`));
    });
    proc.on('error', (err) => reject(err));
  });
}

async function probeVideo(videoPath) {
  const resolved = path.resolve(videoPath);
  if (!fs.existsSync(resolved)) throw new Error(`Video file not found: ${resolved}`);
  const args = ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', resolved];
  const { stdout } = await execFileAsync(ffprobePath, args);
  const data = JSON.parse(stdout);
  const videoStream = data.streams?.find((s) => s.codec_type === 'video') || data.streams?.[0];
  const format = data.format;

  let fps = 15;
  if (videoStream?.r_frame_rate) {
    const [num, den] = videoStream.r_frame_rate.split('/').map(Number);
    if (num && den) fps = Math.round((num / den) * 100) / 100;
  }

  const duration = Number(format?.duration || videoStream?.duration || 0);
  const width = Number(videoStream?.width || 0);
  const height = Number(videoStream?.height || 0);
  const codec = String(videoStream?.codec_name || 'h264');
  const size = Number(format?.size || fs.statSync(resolved).size);

  return { duration, width, height, codec, fps, size };
}

const { SessionMediaPaths } = require('../storage/session-media-paths.cjs');

class DesktopMediaManager {
  constructor(options = {}) {
    const projectRoot = path.resolve(__dirname, '../../../../..');
    this.storageRootDir = path.resolve(options.storageRootDir || process.env.MOMENTAI_STORAGE_DIR || path.join(projectRoot, 'artifacts', 'windowmini-storage'));
    this.sessionMediaPaths = new SessionMediaPaths(this.storageRootDir);
    this.activeSessionId = null;
    this.activeProvider = 'canon';
    this.targetFps = 15;
    this.maxQueueFrames = 300;
    this.sessionClips = new Map(); // sessionId -> Map(shotIndex -> shotState)
    this.sessionProviders = new Map(); // sessionId -> provider
    this.sessionTokens = new Map(); // sessionId -> publicToken
    this.db = null;
    this.jobQueue = [];
    this.isJobProcessing = false;
    this.onJobCompletedCallbacks = [];
  }

  setStorageRootDir(dir) {
    this.storageRootDir = path.resolve(dir);
    this.sessionMediaPaths = new SessionMediaPaths(this.storageRootDir);
  }

  setProvider(provider) {
    this.activeProvider = provider;
  }

  init(db) {
    this.db = db;
    if (this.db) {
      try {
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS media_jobs (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            job_type TEXT NOT NULL,
            status TEXT NOT NULL,
            payload_json TEXT NOT NULL,
            attempt_count INTEGER NOT NULL DEFAULT 0,
            last_error TEXT,
            created_at TEXT NOT NULL,
            started_at TEXT,
            completed_at TEXT,
            updated_at TEXT NOT NULL
          );
          CREATE TABLE IF NOT EXISTS shot_clips (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            shot_index INTEGER NOT NULL,
            local_path TEXT NOT NULL,
            status TEXT NOT NULL,
            started_at TEXT,
            shutter_at TEXT,
            completed_at TEXT,
            duration_ms INTEGER,
            file_size INTEGER,
            width INTEGER,
            height INTEGER,
            fps REAL,
            codec TEXT,
            provider TEXT,
            created_at TEXT NOT NULL
          );
          CREATE TABLE IF NOT EXISTS public_session_tokens (
            session_id TEXT PRIMARY KEY,
            public_token TEXT NOT NULL UNIQUE,
            created_at TEXT NOT NULL
          );
        `);

        // Crash recovery: Recover stale PROCESSING media jobs -> reset to QUEUED
        const now = new Date().toISOString();
        this.db.prepare("UPDATE media_jobs SET status = 'QUEUED', updated_at = ? WHERE status = 'PROCESSING'").run(now);

        const rows = this.db.prepare("SELECT id FROM media_jobs WHERE status = 'QUEUED' ORDER BY created_at ASC").all();
        for (const r of rows) {
          this.jobQueue.push(r.id);
        }
        if (this.jobQueue.length > 0) {
          void this.processNextJob();
        }
      } catch (err) {
        console.warn('[DesktopMediaManager] DB init error:', err);
      }
    }
  }

  getPublicToken(sessionId) {
    if (this.sessionTokens.has(sessionId)) {
      return this.sessionTokens.get(sessionId);
    }
    if (this.db) {
      try {
        const row = this.db.prepare('SELECT public_token FROM public_session_tokens WHERE session_id = ?').get(sessionId);
        if (row?.public_token) {
          this.sessionTokens.set(sessionId, row.public_token);
          return row.public_token;
        }
      } catch {}
    }
    // Generate secure 16-char random token
    const token = crypto.randomBytes(8).toString('hex');
    this.sessionTokens.set(sessionId, token);
    if (this.db) {
      try {
        const now = new Date().toISOString();
        this.db.prepare('INSERT OR IGNORE INTO public_session_tokens (session_id, public_token, created_at) VALUES (?, ?, ?)').run(sessionId, token, now);
      } catch {}
    }
    return token;
  }

  startSession(sessionId, provider) {
    this.activeSessionId = sessionId;
    const resolvedProvider = provider || this.activeProvider;
    this.sessionProviders.set(sessionId, resolvedProvider);
    if (!this.sessionClips.has(sessionId)) {
      this.sessionClips.set(sessionId, new Map());
    }
    this.sessionMediaPaths.ensureSessionDirectories(sessionId);
    this.getPublicToken(sessionId);
  }

  startShotClip(sessionId, shotIndex, countdownStartedAt) {
    const provider = this.sessionProviders.get(sessionId) || this.activeProvider;
    this.startSession(sessionId, provider);
    const sessionMap = this.sessionClips.get(sessionId);
    const startedAt = countdownStartedAt || new Date().toISOString();
    const localPath = this.sessionMediaPaths.clip(sessionId, shotIndex + 1);

    const shotState = {
      shotIndex,
      status: 'recording',
      startedAt,
      frames: [],
      provider,
      localPath,
    };
    sessionMap.set(shotIndex, shotState);

    const meta = {
      id: `clip_${sessionId}_${shotIndex + 1}`,
      sessionId,
      shotIndex,
      localPath,
      status: 'recording',
      startedAt,
      provider,
    };
    shotState.metadata = meta;
    return meta;
  }

  pushCanonLiveViewFrame(frame) {
    for (const [, sessionMap] of this.sessionClips.entries()) {
      for (const shotState of sessionMap.values()) {
        if (shotState.status === 'recording') {
          let buffer = null;
          if (frame.data && Buffer.isBuffer(frame.data)) {
            buffer = frame.data;
          } else if (frame.dataUrl && typeof frame.dataUrl === 'string') {
            const base64 = frame.dataUrl.split(',').pop() || frame.dataUrl;
            buffer = Buffer.from(base64, 'base64');
          }

          if (buffer && buffer.length > 0) {
            shotState.frames.push({
              data: buffer,
              timestamp: Date.now(),
              width: frame.width || 1920,
              height: frame.height || 1080,
              seq: frame.seq,
            });

            if (shotState.frames.length > this.maxQueueFrames) {
              shotState.frames.shift();
            }
          }
        }
      }
    }
  }

  pushDevicePreviewFrame(sessionId, shotIndex, frameBuffer, width, height) {
    const sessionMap = this.sessionClips.get(sessionId);
    if (!sessionMap) return;
    const shotState = sessionMap.get(shotIndex);
    if (shotState && shotState.status === 'recording') {
      shotState.frames.push({
        data: frameBuffer,
        timestamp: Date.now(),
        width: width || 1920,
        height: height || 1080,
      });
      if (shotState.frames.length > this.maxQueueFrames) {
        shotState.frames.shift();
      }
    }
  }

  markShutter(sessionId, shotIndex, shutterAt) {
    const sessionMap = this.sessionClips.get(sessionId);
    if (!sessionMap) return null;
    const shotState = sessionMap.get(shotIndex);
    if (!shotState) return null;
    shotState.shutterAt = shutterAt || new Date().toISOString();
    if (shotState.metadata) {
      shotState.metadata.shutterAt = shotState.shutterAt;
    }
    return shotState.metadata || null;
  }

  async stopShotClip(sessionId, shotIndex, capturedPhotoPersistedAt, options = {}) {
    const sessionMap = this.sessionClips.get(sessionId);
    if (!sessionMap) throw new Error(`Session ${sessionId} not found.`);
    const shotState = sessionMap.get(shotIndex);
    if (!shotState) throw new Error(`Shot ${shotIndex} for session ${sessionId} not found.`);

    shotState.completedAt = capturedPhotoPersistedAt || new Date().toISOString();
    shotState.status = 'finalizing';

    const clipsDir = path.join(this.storageRootDir, 'sessions', sessionId, 'clips');
    fs.mkdirSync(clipsDir, { recursive: true });
    const outputPath = path.join(clipsDir, `shot_${String(shotIndex + 1).padStart(2, '0')}.mp4`);

    try {
      // In Canon mode, fallback placeholder injection is strictly forbidden
      if (shotState.provider === 'canon') {
        if (shotState.frames.length === 0) {
          shotState.status = 'failed';
          shotState.error = 'NO_CANON_EVF_FRAMES_FOR_CLIP';
          const meta = {
            id: `clip_${sessionId}_${shotIndex + 1}`,
            sessionId,
            shotIndex,
            localPath: outputPath,
            status: 'failed',
            startedAt: shotState.startedAt,
            shutterAt: shotState.shutterAt,
            completedAt: shotState.completedAt,
            provider: 'canon',
            error: 'NO_CANON_EVF_FRAMES_FOR_CLIP',
          };
          shotState.metadata = meta;
          this.saveClipToDb(meta);
          return meta;
        }
      } else {
        if (shotState.frames.length === 0 && options.fallbackImageBuffer) {
          for (let k = 0; k < 15; k++) {
            shotState.frames.push({
              data: options.fallbackImageBuffer,
              timestamp: Date.now() + k * 66,
              width: 1920,
              height: 1080,
            });
          }
        } else if (shotState.frames.length === 1) {
          const single = shotState.frames[0];
          for (let k = 1; k < 15; k++) {
            shotState.frames.push({
              data: single.data,
              timestamp: single.timestamp + k * 66,
              width: single.width,
              height: single.height,
            });
          }
        }
      }

      if (shotState.frames.length === 0) {
        shotState.status = 'failed';
        shotState.error = 'NO_FRAMES_CAPTURED';
        const meta = {
          id: `clip_${sessionId}_${shotIndex + 1}`,
          sessionId,
          shotIndex,
          localPath: outputPath,
          status: 'failed',
          startedAt: shotState.startedAt,
          shutterAt: shotState.shutterAt,
          completedAt: shotState.completedAt,
          provider: shotState.provider,
          error: 'NO_FRAMES_CAPTURED',
        };
        shotState.metadata = meta;
        this.saveClipToDb(meta);
        return meta;
      }

      // Encode via FFmpeg
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'momentai-shot-'));
      try {
        let calculatedFps = this.targetFps;
        if (shotState.frames.length >= 2) {
          const durSec = (shotState.frames[shotState.frames.length - 1].timestamp - shotState.frames[0].timestamp) / 1000;
          if (durSec > 0.2) {
            calculatedFps = Math.max(5, Math.min(30, Math.round((shotState.frames.length / durSec) * 10) / 10));
          }
        }

        for (let i = 0; i < shotState.frames.length; i++) {
          const fPath = path.join(tempDir, `frame_${String(i + 1).padStart(5, '0')}.jpg`);
          fs.writeFileSync(fPath, shotState.frames[i].data);
        }

        const args = [
          '-y',
          '-framerate', String(calculatedFps),
          '-i', path.join(tempDir, 'frame_%05d.jpg'),
          '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2',
          '-c:v', 'libx264',
          '-pix_fmt', 'yuv420p',
          '-preset', 'veryfast',
          '-crf', '23',
          '-movflags', '+faststart',
          outputPath,
        ];
        await runFfmpeg(args);
      } finally {
        try {
          fs.rmSync(tempDir, { recursive: true, force: true });
        } catch {}
      }

      // Clear memory
      shotState.frames = [];

      const probe = await probeVideo(outputPath).catch(() => null);
      const stat = fs.statSync(outputPath);

      shotState.status = 'ready';
      const meta = {
        id: `clip_${sessionId}_${shotIndex + 1}`,
        sessionId,
        shotIndex,
        localPath: outputPath,
        status: 'ready',
        startedAt: shotState.startedAt,
        shutterAt: shotState.shutterAt,
        completedAt: shotState.completedAt,
        durationMs: probe?.duration ? Math.round(probe.duration * 1000) : 1000,
        fileSize: stat.size,
        width: probe?.width || 1920,
        height: probe?.height || 1080,
        fps: probe?.fps || this.targetFps,
        codec: probe?.codec || 'h264',
        provider: shotState.provider,
      };
      shotState.metadata = meta;
      this.saveClipToDb(meta);
      return meta;
    } catch (err) {
      shotState.status = 'failed';
      shotState.error = err.message;
      shotState.frames = [];
      const meta = {
        id: `clip_${sessionId}_${shotIndex + 1}`,
        sessionId,
        shotIndex,
        localPath: outputPath,
        status: 'failed',
        startedAt: shotState.startedAt,
        shutterAt: shotState.shutterAt,
        completedAt: shotState.completedAt,
        provider: shotState.provider,
        error: err.message,
      };
      shotState.metadata = meta;
      this.saveClipToDb(meta);
      return meta;
    }
  }

  saveClipToDb(meta) {
    if (this.db) {
      try {
        const now = new Date().toISOString();
        this.db.prepare(`
          INSERT INTO shot_clips (
            id, session_id, shot_index, local_path, status, started_at, shutter_at, completed_at, duration_ms, file_size, width, height, fps, codec, provider, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            status = excluded.status,
            shutter_at = excluded.shutter_at,
            completed_at = excluded.completed_at,
            duration_ms = excluded.duration_ms,
            file_size = excluded.file_size,
            width = excluded.width,
            height = excluded.height,
            fps = excluded.fps,
            codec = excluded.codec
        `).run(
          meta.id, meta.sessionId, meta.shotIndex, meta.localPath, meta.status,
          meta.startedAt || null, meta.shutterAt || null, meta.completedAt || null,
          meta.durationMs || null, meta.fileSize || null, meta.width || null,
          meta.height || null, meta.fps || null, meta.codec || null, meta.provider || 'canon', now
        );
      } catch (e) {
        console.warn('[DesktopMediaManager] saveClipToDb error:', e);
      }
    }
  }

  getClips(sessionId) {
    const sessionMap = this.sessionClips.get(sessionId);
    if (sessionMap) {
      return Array.from(sessionMap.values())
        .map((s) => s.metadata || {
          id: `clip_${sessionId}_${s.shotIndex + 1}`,
          sessionId,
          shotIndex: s.shotIndex,
          localPath: s.localPath,
          status: s.status,
          startedAt: s.startedAt,
          shutterAt: s.shutterAt,
          completedAt: s.completedAt,
          provider: s.provider,
        })
        .sort((a, b) => a.shotIndex - b.shotIndex);
    }
    if (this.db) {
      try {
        const rows = this.db.prepare('SELECT * FROM shot_clips WHERE session_id = ? ORDER BY shot_index ASC').all(sessionId);
        return rows.map((r) => ({
          id: r.id,
          sessionId: r.session_id,
          shotIndex: r.shot_index,
          localPath: r.local_path,
          status: r.status,
          startedAt: r.started_at,
          shutterAt: r.shutter_at,
          completedAt: r.completed_at,
          durationMs: r.duration_ms,
          fileSize: r.file_size,
          width: r.width,
          height: r.height,
          fps: r.fps,
          codec: r.codec,
          provider: r.provider,
        }));
      } catch {}
    }
    return [];
  }

  async composeFrameVideo(options) {
    const {
      sessionId,
      frame,
      overlayUrl = frame?.assets?.overlay || frame?.assetUrl,
      drawDataUrl,
      durationMs = 4000,
      targetWidth,
      targetHeight,
    } = options;

    const clips = this.getClips(sessionId);
    const slots = frame.slots || [];
    if (slots.length === 0) throw new Error('[DesktopMediaManager] Frame definition contains no slots.');

    const rawW = targetWidth || frame.outputWidth || 1800;
    const rawH = targetHeight || frame.outputHeight || 2700;
    const outputWidth = Math.floor(rawW / 2) * 2;
    const outputHeight = Math.floor(rawH / 2) * 2;
    const durationSec = durationMs / 1000;

    const outputsDir = this.sessionMediaPaths.outputsDir(sessionId);
    fs.mkdirSync(outputsDir, { recursive: true });
    const outputPath = this.sessionMediaPaths.finalVideo(sessionId);

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'momentai-video-compose-'));

    try {
      const inputArgs = [];
      const filterChains = [];

      const bg = frame.assets?.background;
      const bgColor = bg && bg !== 'transparent' && bg.startsWith('#') ? bg : '#ffffff';
      filterChains.push(`color=c=${bgColor}:s=${outputWidth}x${outputHeight}:d=${durationSec}:r=25 [base0]`);
      let currentBase = 'base0';

      let inputCount = 0;
      for (let i = 0; i < slots.length; i++) {
        const slot = slots[i];
        const clip = clips[i];

        if (!clip || clip.status === 'failed' || !clip.localPath || !fs.existsSync(clip.localPath)) {
          throw new Error(`Missing required shot clip for slot #${i + 1} (${clip?.localPath || 'not found'})`);
        }

        const inputIndex = inputCount;
        inputCount++;
        inputArgs.push('-stream_loop', '-1', '-i', path.resolve(clip.localPath));

        const slotPx = normalizeSlotToPixels(slot, outputWidth, outputHeight);
        const destW = Math.max(2, Math.floor(slotPx.width / 2) * 2);
        const destH = Math.max(2, Math.floor(slotPx.height / 2) * 2);
        const destX = Math.max(0, Math.round(slotPx.x));
        const destY = Math.max(0, Math.round(slotPx.y));

        const probe = await probeVideo(clip.localPath).catch(() => null);
        const clipW = probe?.width || clip.width || 1920;
        const clipH = probe?.height || clip.height || 1080;

        const crop = calculateSourceCropRect(clipW, clipH, destW, destH);
        const cropW = Math.max(2, Math.floor(crop.cropW / 2) * 2);
        const cropH = Math.max(2, Math.floor(crop.cropH / 2) * 2);
        const cropX = Math.max(0, Math.floor(crop.cropX / 2) * 2);
        const cropY = Math.max(0, Math.floor(crop.cropY / 2) * 2);

        const slotLabel = `slot${i}`;
        const nextBase = `base${i + 1}`;

        filterChains.push(
          `[${inputIndex}:v] trim=duration=${durationSec}, setpts=PTS-STARTPTS, crop=${cropW}:${cropH}:${cropX}:${cropY}, scale=${destW}:${destH} [${slotLabel}]`
        );
        filterChains.push(
          `[${currentBase}][${slotLabel}] overlay=${destX}:${destY}:eof_action=repeat [${nextBase}]`
        );
        currentBase = nextBase;
      }

      // Overlay PNG (Layer 20)
      let overlayFilePath = null;
      if (overlayUrl) {
        if (overlayUrl.startsWith('data:image/')) {
          const base64 = overlayUrl.split(',').pop() || '';
          overlayFilePath = path.join(tempDir, 'overlay.png');
          fs.writeFileSync(overlayFilePath, Buffer.from(base64, 'base64'));
        } else if (fs.existsSync(overlayUrl)) {
          overlayFilePath = path.resolve(overlayUrl);
        } else if (overlayUrl.startsWith('/')) {
          const p = path.join(process.cwd(), 'public', overlayUrl);
          if (fs.existsSync(p)) overlayFilePath = p;
        }
      }

      if (overlayFilePath && fs.existsSync(overlayFilePath)) {
        const overlayIdx = inputCount;
        inputCount++;
        inputArgs.push('-loop', '1', '-i', overlayFilePath);
        const overlayBase = 'base_overlay';
        filterChains.push(
          `[${overlayIdx}:v] trim=duration=${durationSec}, setpts=PTS-STARTPTS, scale=${outputWidth}:${outputHeight} [overlay_scaled]`
        );
        filterChains.push(
          `[${currentBase}][overlay_scaled] overlay=0:0:eof_action=repeat [${overlayBase}]`
        );
        currentBase = overlayBase;
      }

      // Draw Overlay (Layer 30)
      let drawFilePath = null;
      if (drawDataUrl && drawDataUrl.startsWith('data:image/')) {
        const base64 = drawDataUrl.split(',').pop() || '';
        drawFilePath = path.join(tempDir, 'draw.png');
        fs.writeFileSync(drawFilePath, Buffer.from(base64, 'base64'));
      }
      if (drawFilePath && fs.existsSync(drawFilePath)) {
        const drawIdx = inputCount;
        inputCount++;
        inputArgs.push('-loop', '1', '-i', drawFilePath);
        const drawBase = 'base_draw';
        filterChains.push(
          `[${drawIdx}:v] trim=duration=${durationSec}, setpts=PTS-STARTPTS, scale=${outputWidth}:${outputHeight} [draw_scaled]`
        );
        filterChains.push(
          `[${currentBase}][draw_scaled] overlay=0:0:eof_action=repeat [${drawBase}]`
        );
        currentBase = drawBase;
      }

      const filterComplex = filterChains.join('; ');
      const tempOutputFile = path.join(tempDir, 'temp-final-video.mp4');
      const ffmpegArgs = [
        '-y',
        ...inputArgs,
        '-filter_complex', filterComplex,
        '-map', `[${currentBase}]`,
        '-t', String(durationSec),
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-preset', 'veryfast',
        '-crf', '23',
        '-movflags', '+faststart',
        tempOutputFile,
      ];

      await runFfmpeg(ffmpegArgs);

      const probe = await probeVideo(tempOutputFile);
      if (!probe || probe.size === 0 || !probe.width || !probe.height) {
        throw new Error('[DesktopMediaManager] Output video validation failed: empty or corrupt stream.');
      }

      fs.copyFileSync(tempOutputFile, outputPath);
      const stat = fs.statSync(outputPath);

      return {
        outputPath,
        durationMs: probe.duration ? Math.round(probe.duration * 1000) : durationMs,
        width: probe.width || outputWidth,
        height: probe.height || outputHeight,
        fileSize: stat.size,
        codec: probe.codec || 'h264',
        fps: probe.fps || 25,
      };
    } finally {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {}
    }
  }

  enqueueMediaJob(sessionId, jobType, payload, idempotencyKey) {
    if (!this.db) return null;
    const jobId = idempotencyKey || `job_${jobType.toLowerCase()}_${sessionId}_${Date.now().toString(36)}`;
    const now = new Date().toISOString();

    const existing = this.db.prepare('SELECT * FROM media_jobs WHERE id = ?').get(jobId);
    if (existing) {
      return {
        id: existing.id,
        sessionId: existing.session_id,
        jobType: existing.job_type,
        status: existing.status,
        payload: JSON.parse(existing.payload_json || '{}'),
      };
    }

    this.db.prepare(`
      INSERT INTO media_jobs (
        id, session_id, job_type, status, payload_json, attempt_count, last_error, created_at, started_at, completed_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(jobId, sessionId, jobType, 'QUEUED', JSON.stringify(payload), 0, null, now, null, null, now);

    this.jobQueue.push(jobId);
    void this.processNextJob();

    return { id: jobId, sessionId, jobType, status: 'QUEUED', payload };
  }

  async processNextJob() {
    if (this.isJobProcessing || this.jobQueue.length === 0) return;
    this.isJobProcessing = true;

    const jobId = this.jobQueue.shift();
    if (!jobId) {
      this.isJobProcessing = false;
      return;
    }

    try {
      const row = this.db.prepare('SELECT * FROM media_jobs WHERE id = ?').get(jobId);
      if (!row || row.status !== 'QUEUED') {
        this.isJobProcessing = false;
        void this.processNextJob();
        return;
      }

      const now = new Date().toISOString();
      this.db.prepare("UPDATE media_jobs SET status = 'PROCESSING', started_at = ?, updated_at = ? WHERE id = ?").run(now, now, jobId);

      const payload = JSON.parse(row.payload_json || '{}');
      if (row.job_type === 'FRAME_VIDEO_COMPOSE') {
        await this.composeFrameVideo({
          sessionId: row.session_id,
          frame: payload.frame,
          overlayUrl: payload.overlayUrl,
          drawDataUrl: payload.drawDataUrl,
          durationMs: payload.durationMs,
          targetWidth: payload.targetWidth,
          targetHeight: payload.targetHeight,
        });
      }

      const completedNow = new Date().toISOString();
      this.db.prepare("UPDATE media_jobs SET status = 'COMPLETED', completed_at = ?, updated_at = ? WHERE id = ?").run(completedNow, completedNow, jobId);

      for (const cb of this.onJobCompletedCallbacks) {
        try {
          cb({ id: jobId, sessionId: row.session_id, jobType: row.job_type, status: 'COMPLETED' });
        } catch {}
      }
    } catch (err) {
      console.warn(`[DesktopMediaManager] Job ${jobId} failed:`, err);
      const errNow = new Date().toISOString();
      const current = this.db.prepare('SELECT attempt_count FROM media_jobs WHERE id = ?').get(jobId);
      const nextAttempts = (current?.attempt_count || 0) + 1;
      if (nextAttempts < 2) {
        this.db.prepare("UPDATE media_jobs SET status = 'QUEUED', attempt_count = ?, last_error = ?, updated_at = ? WHERE id = ?").run(nextAttempts, err.message, errNow, jobId);
        setTimeout(() => {
          this.jobQueue.push(jobId);
          void this.processNextJob();
        }, 2000);
      } else {
        this.db.prepare("UPDATE media_jobs SET status = 'FAILED', attempt_count = ?, last_error = ?, updated_at = ? WHERE id = ?").run(nextAttempts, err.message, errNow, jobId);
        for (const cb of this.onJobCompletedCallbacks) {
          try {
            cb({ id: jobId, sessionId: row.session_id, jobType: row.job_type, status: 'FAILED', error: err.message });
          } catch {}
        }
      }
    } finally {
      this.isJobProcessing = false;
      setTimeout(() => void this.processNextJob(), 100);
    }
  }

  onJobCompleted(cb) {
    this.onJobCompletedCallbacks.push(cb);
  }

  getSessionMediaPackage(sessionId, origin) {
    const publicToken = this.getPublicToken(sessionId);
    const host = origin || 'http://localhost:3000';
    const shareUrl = `${host}/s/${sessionId}?token=${publicToken}`;

    const imagePath = this.sessionMediaPaths.finalImage(sessionId);
    const videoPath = this.sessionMediaPaths.finalVideo(sessionId);

    let finalImage = null;
    if (fs.existsSync(imagePath)) {
      const stat = fs.statSync(imagePath);
      finalImage = {
        path: imagePath,
        size: stat.size,
        width: 1800,
        height: 2700,
      };
    }

    let finalVideo = null;
    if (fs.existsSync(videoPath)) {
      const stat = fs.statSync(videoPath);
      finalVideo = {
        path: videoPath,
        size: stat.size,
        duration: 4.0,
        width: 1800,
        height: 2700,
        codec: 'h264',
      };
    }

    const status = finalImage && finalVideo ? 'ready' : (finalImage || finalVideo) ? 'processing' : 'pending';

    return {
      sessionId,
      publicToken,
      shareUrl,
      finalImage,
      finalVideo,
      status,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
}

const desktopMediaManager = new DesktopMediaManager();

module.exports = {
  DesktopMediaManager,
  desktopMediaManager,
  normalizeSlotToPixels,
  calculateSourceCropRect,
  runFfmpeg,
  probeVideo,
};
