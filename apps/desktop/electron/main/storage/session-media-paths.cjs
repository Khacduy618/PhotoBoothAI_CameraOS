/**
 * session-media-paths.cjs
 *
 * Single Canonical Path Resolver for MomentAI CameraOS.
 * Enforces the canonical directory structure:
 *
 * <sessionId>/
 * ├── photos/
 * │   ├── shot_01.jpg
 * │   └── ...
 * ├── clips/
 * │   ├── shot_01.mp4
 * │   └── ...
 * ├── outputs/
 * │   ├── final-image.jpg
 * │   └── final-video.mp4
 * ├── manifest.json
 * └── metadata.json
 */

const path = require('path');
const fs = require('fs');

const PRODUCTION_APP_DATA_DIR = path.join('MomentAI', 'Photobooth');

function resolveMomentAIStorageRoot(env = process.env, platform = process.platform) {
  if (env.MOMENTAI_STORAGE_DIR) {
    return path.resolve(env.MOMENTAI_STORAGE_DIR);
  }
  if (platform === 'win32' && env.LOCALAPPDATA) {
    return path.join(env.LOCALAPPDATA, PRODUCTION_APP_DATA_DIR);
  }
  const projectRoot = path.resolve(__dirname, '../../../../..');
  return path.join(projectRoot, 'artifacts', 'windowmini-storage');
}

class SessionMediaPaths {
  constructor(storageRootDir) {
    this.storageRootDir = path.resolve(storageRootDir || resolveMomentAIStorageRoot());
  }

  storageRoot() {
    return this.storageRootDir;
  }

  getStorageRoot() {
    return this.storageRootDir;
  }

  sessionsRoot() {
    return path.join(this.storageRootDir, 'sessions');
  }

  sessionRoot(sessionId) {
    const safeId = String(sessionId || 'unknown_session').replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.sessionsRoot(), safeId);
  }

  photosDir(sessionId) {
    return path.join(this.sessionRoot(sessionId), 'photos');
  }

  clipsDir(sessionId) {
    return path.join(this.sessionRoot(sessionId), 'clips');
  }

  outputsDir(sessionId) {
    return path.join(this.sessionRoot(sessionId), 'outputs');
  }

  photo(sessionId, shotIndex, ext = '.jpg') {
    const idx = Number.isFinite(Number(shotIndex)) ? Number(shotIndex) : 1;
    return path.join(this.photosDir(sessionId), `shot_${String(idx).padStart(2, '0')}${ext}`);
  }

  clip(sessionId, shotIndex, ext = '.mp4') {
    const idx = Number.isFinite(Number(shotIndex)) ? Number(shotIndex) : 1;
    return path.join(this.clipsDir(sessionId), `shot_${String(idx).padStart(2, '0')}${ext}`);
  }

  timelapseVideo(sessionId) {
    return path.join(this.clipsDir(sessionId), 'timelapse-video.mp4');
  }

  finalImage(sessionId) {
    return path.join(this.outputsDir(sessionId), 'final-image.jpg');
  }

  finalVideo(sessionId) {
    return path.join(this.outputsDir(sessionId), 'final-video.mp4');
  }

  printDir(sessionId) {
    return path.join(this.outputsDir(sessionId), 'print');
  }

  printMaster(sessionId, profileId = 'cp1000', jobId = '') {
    if (jobId) {
      const safeJob = String(jobId).replace(/[^a-zA-Z0-9_-]/g, '_');
      return path.join(this.printDir(sessionId), `print_${safeJob}.jpg`);
    }
    return path.join(this.outputsDir(sessionId), 'print-cp1000.jpg');
  }

  metadata(sessionId) {
    return path.join(this.sessionRoot(sessionId), 'metadata.json');
  }

  manifest(sessionId) {
    return path.join(this.sessionRoot(sessionId), 'manifest.json');
  }

  ensureSessionDirectories(sessionId) {
    const root = this.sessionRoot(sessionId);
    const photos = this.photosDir(sessionId);
    const clips = this.clipsDir(sessionId);
    const outputs = this.outputsDir(sessionId);
    const printDir = this.printDir(sessionId);

    fs.mkdirSync(photos, { recursive: true });
    fs.mkdirSync(clips, { recursive: true });
    fs.mkdirSync(outputs, { recursive: true });
    fs.mkdirSync(printDir, { recursive: true });

    return { root, photos, clips, outputs, printDir };
  }
}

module.exports = { SessionMediaPaths, resolveMomentAIStorageRoot };
