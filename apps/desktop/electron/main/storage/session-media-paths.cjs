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

class SessionMediaPaths {
  constructor(storageRootDir) {
    const projectRoot = path.resolve(__dirname, '../../../../..');
    this.storageRootDir = path.resolve(
      storageRootDir ||
      process.env.MOMENTAI_STORAGE_DIR ||
      path.join(projectRoot, 'artifacts', 'windowmini-storage')
    );
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

  finalImage(sessionId) {
    return path.join(this.outputsDir(sessionId), 'final-image.jpg');
  }

  finalVideo(sessionId) {
    return path.join(this.outputsDir(sessionId), 'final-video.mp4');
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

    fs.mkdirSync(photos, { recursive: true });
    fs.mkdirSync(clips, { recursive: true });
    fs.mkdirSync(outputs, { recursive: true });

    return { root, photos, clips, outputs };
  }
}

module.exports = { SessionMediaPaths };
