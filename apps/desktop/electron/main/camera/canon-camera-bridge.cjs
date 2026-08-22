const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const EventEmitter = require('events');

class CanonCameraBridgeManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = options;
    this.process = null;
    this.state = 'DISCONNECTED'; // DISCONNECTED | CONNECTING | OPENING_SESSION | READY | LIVEVIEW | CAPTURING | DOWNLOADING | ERROR | TERMINAL_FAILED
    this.cameraModel = null;
    this.cameraCount = 0;
    this.currentPendingCapture = null;
    this.latestEvfFrame = null;
    this.binaryPath = options.binaryPath || path.join(__dirname, 'canon', 'bin', 'canon_bridge_mac');
    this.reconnectTimer = null;
    this.isShuttingDown = false;
    this.lastError = null;

    // Enumerate concurrency and authoritative result tracking
    this.enumerateInFlight = false;
    this.currentEnumRequestId = 0;
    this.lastEnumBeginAt = 0;
    this.lastEnumEndAt = 0;
    this.lastEnumElapsedMs = 0;
    this.lastEnumResult = 'NONE';
    this.lastEnumCount = 0;
    this.lastEnumTimeoutOccurred = false;
  }

  logEnumStatus(extra = {}) {
    console.log('[CANON_ENUM_STATUS]', JSON.stringify({
      ENUM_REQUEST_ID: this.currentEnumRequestId,
      ENUM_BEGIN_AT: this.lastEnumBeginAt,
      ENUM_END_AT: this.lastEnumEndAt,
      ENUM_ELAPSED_MS: this.lastEnumElapsedMs,
      ENUM_RESULT: this.lastEnumResult,
      ENUM_COUNT: this.lastEnumCount,
      ENUM_TIMEOUT_OCCURRED: this.lastEnumTimeoutOccurred ? 'YES' : 'NO',
      ENUM_IN_FLIGHT: this.enumerateInFlight ? 1 : 0,
      BRIDGE_STATE: this.state,
      ...extra,
    }));
  }

  checkContention() {
    try {
      const { execSync } = require('child_process');
      const stdout = execSync('ps -eo comm', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
      const lines = stdout.split('\n');
      for (const line of lines) {
        if (line.includes('EOS Utility') || line.includes('PTPCamera') || line.includes('ptpcamerad') || line.includes('Photos')) {
          return true;
        }
      }
    } catch (e) {
      // ignore
    }
    return false;
  }

  async enumerateCameras(timeoutMs = 25000) {
    if (this.enumerateInFlight) {
      console.warn(`[CanonBridge] Enumerate request already in flight (request ${this.currentEnumRequestId}). Refusing concurrent enumerate.`);
      this.logEnumStatus({ ACTION: 'CONCURRENT_REFUSED' });
      return false;
    }

    this.currentEnumRequestId++;
    const reqId = this.currentEnumRequestId;
    this.enumerateInFlight = true;
    this.lastEnumBeginAt = Date.now();
    this.lastEnumEndAt = 0;
    this.lastEnumElapsedMs = 0;
    this.lastEnumResult = 'PENDING';
    this.lastEnumCount = 0;
    this.lastEnumTimeoutOccurred = false;

    this.state = 'ENUMERATING';
    this.emit('stateChanged', { state: this.state });
    this.logEnumStatus({ ACTION: 'BEGIN' });

    await this.sendCommand({ command: 'enumerate', requestId: reqId });

    const result = await Promise.race([
      new Promise((resolve) => {
        const onDiscovered = (event) => {
          this.removeListener('cameraDiscovered', onDiscovered);
          this.removeListener('enumerationFailed', onFailed);
          resolve({ type: 'discovered', event });
        };
        const onFailed = (err) => {
          this.removeListener('cameraDiscovered', onDiscovered);
          this.removeListener('enumerationFailed', onFailed);
          resolve({ type: 'error', error: err });
        };
        this.once('cameraDiscovered', onDiscovered);
        this.once('enumerationFailed', onFailed);
      }),
      new Promise((resolve) => setTimeout(() => resolve({ type: 'timeout' }), timeoutMs)),
    ]);

    if (result.type === 'timeout') {
      // Note: do not reset this.enumerateInFlight to 0 if native process is still busy
      this.lastEnumTimeoutOccurred = true;
      this.lastEnumElapsedMs = Date.now() - this.lastEnumBeginAt;
      this.lastEnumResult = 'ENUMERATION_TIMEOUT';
      this.state = 'ENUMERATION_TIMEOUT';
      this.lastError = 'ENUMERATION_TIMEOUT';
      this.emit('stateChanged', { state: this.state });
      this.logEnumStatus({ ACTION: 'TIMEOUT_TRIGGERED' });
      console.warn(`[CanonBridge] Native enumeration timed out after ${timeoutMs}ms. Preserving ENUMERATION_TIMEOUT state without activating fallback.`);
      return false;
    }

    this.enumerateInFlight = false;
    this.lastEnumEndAt = Date.now();
    this.lastEnumElapsedMs = this.lastEnumEndAt - this.lastEnumBeginAt;

    if (result.type === 'error') {
      this.lastEnumResult = result.error?.code || 'ENUMERATION_FAILED';
      this.state = 'ENUMERATION_FAILED';
      this.lastError = result.error?.message || 'Native enumeration failed';
      this.emit('stateChanged', { state: this.state });
      this.logEnumStatus({ ACTION: 'ERROR' });
      return false;
    }

    const event = result.event;
    this.lastEnumResult = 'EDS_ERR_OK';
    this.lastEnumCount = Number(event.count) || 0;

    if (this.lastEnumCount > 0) {
      this.cameraCount = this.lastEnumCount;
      this.cameraModel = event.model || 'Canon EOS 6D';
      this.state = 'CANON_PRESENT';
      this.emit('stateChanged', { state: this.state });
      this.logEnumStatus({ ACTION: 'CANON_PRESENT' });
      return true;
    } else {
      this.cameraCount = 0;
      this.state = 'NO_CANON_DETECTED';
      this.emit('stateChanged', { state: this.state });
      this.logEnumStatus({ ACTION: 'NO_CANON_DETECTED' });
      return false;
    }
  }

  async start() {
    if (this.process && (this.state === 'READY' || this.state === 'LIVEVIEW')) return true;
    if (!fs.existsSync(this.binaryPath)) {
      console.warn(`[CanonBridge] Binary not found at ${this.binaryPath}`);
      this.state = 'DISCONNECTED';
      return false;
    }

    this.state = 'CONNECTING';
    this.emit('stateChanged', { state: this.state });
    try {
      this.process = spawn(this.binaryPath, [], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdoutBuffer = '';
      this.process.stdout.on('data', (data) => {
        stdoutBuffer += data.toString();
        const lines = stdoutBuffer.split('\n');
        stdoutBuffer = lines.pop(); // keep partial line

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const event = JSON.parse(trimmed);
            this.handleBridgeEvent(event);
          } catch (e) {
            console.debug('[CanonBridge stdout raw]', trimmed);
          }
        }
      });

      this.process.stderr.on('data', (data) => {
        const text = data.toString().trim();
        if (text) console.debug('[CanonBridge stderr]', text);
      });

      this.process.on('close', (code) => {
        console.log(`[CanonBridge] Process closed with code ${code}`);
        this.process = null;
        this.enumerateInFlight = false;
        this.state = 'DISCONNECTED';
        this.emit('stateChanged', { state: this.state });
        this.emit('disconnected', { code });
        if (this.currentPendingCapture) {
          this.currentPendingCapture.reject(new Error(`Bridge closed unexpectedly with code ${code}`));
          this.currentPendingCapture = null;
        }
      });

      this.process.on('error', (err) => {
        console.error('[CanonBridge] Process error:', err);
        this.enumerateInFlight = false;
        this.state = 'ERROR';
        this.lastError = err.message;
        this.emit('stateChanged', { state: this.state });
        this.emit('error', err);
      });

      // 0. Await bridgeReady from native binary
      await Promise.race([
        new Promise((resolve) => this.once('ready', resolve)),
        new Promise((resolve) => setTimeout(resolve, 2000)),
      ]);

      // 1. Send initialize command and await response
      await this.sendCommand({ command: 'initialize' });
      await Promise.race([
        new Promise((resolve) => this.once('initialized', resolve)),
        new Promise((resolve) => this.once('error', resolve)),
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ]);

      // 2. Perform authoritative camera enumeration (25s timeout)
      const hasCanon = await this.enumerateCameras(25000);

      if (hasCanon && this.cameraCount > 0) {
        // 3. Hardware detected -> Enter OPENING_SESSION
        this.state = 'OPENING_SESSION';
        this.emit('stateChanged', { state: this.state });
        console.log(`[CanonBridge] Detected ${this.cameraCount} Canon camera(s): ${this.cameraModel}. Opening session...`);

        // Wait up to 3s for sessionOpened confirmation on normal start
        let opened = await Promise.race([
          new Promise((resolve) => {
            const onOpen = () => {
              this.removeListener('sessionOpened', onOpen);
              resolve(true);
            };
            this.once('sessionOpened', onOpen);
          }),
          new Promise((resolve) => setTimeout(() => resolve(false), 3000)),
        ]);

        if (!opened && this.state !== 'READY' && this.state !== 'LIVEVIEW') {
          // Check for contention with other camera applications
          const hasContention = this.checkContention();
          if (hasContention) {
            console.warn('[CanonBridge] OpenSession blocked due to contention with EOS Utility / PTPCamera. Refusing to force unlink.');
            this.state = 'CONTENTION_BUSY';
            this.lastError = 'CAMERA_BUSY_CONTENTION';
            this.emit('stateChanged', { state: this.state });
            return false;
          }

          // No other process running -> Safe recovery from abnormal previous exit
          console.log('[CanonBridge] Abnormal predecessor exit detected. Executing safe stale lock recovery...');
          await this.sendCommand({ command: 'cleanStaleLock' });
          await new Promise((r) => setTimeout(r, 200));

          await this.sendCommand({ command: 'openSession' });
          opened = await Promise.race([
            new Promise((resolve) => {
              const onOpen = () => {
                this.removeListener('sessionOpened', onOpen);
                resolve(true);
              };
              this.once('sessionOpened', onOpen);
            }),
            new Promise((resolve) => setTimeout(() => resolve(false), 3000)),
          ]);
        }

        if (opened || this.state === 'READY' || this.state === 'LIVEVIEW') {
          this.state = 'READY';
          this.emit('stateChanged', { state: this.state });
          console.log(`[CanonBridge] Ready with camera: ${this.cameraModel}`);
          return true;
        } else {
          console.warn(`[CanonBridge] OpenSession timeout or pending for ${this.cameraModel}`);
          if (this.state !== 'ERROR') {
            this.state = 'OPENING_SESSION';
          }
          this.emit('stateChanged', { state: this.state });
          return false;
        }
      } else if (this.state === 'ENUMERATION_TIMEOUT') {
        console.warn(`[CanonBridge] Enumeration timed out. Preserving ENUMERATION_TIMEOUT state without activating fallback.`);
        return false;
      } else {
        console.log('[CanonBridge] Authoritative enumeration completed: No Canon camera detected');
        this.state = 'NO_CANON_DETECTED';
        this.emit('stateChanged', { state: this.state });
        return false;
      }
    } catch (err) {
      console.error('[CanonBridge] Failed to start bridge:', err);
      this.enumerateInFlight = false;
      this.state = 'ERROR';
      this.lastError = err.message;
      this.emit('stateChanged', { state: this.state });
      return false;
    }
  }

  async sendCommand(cmd) {
    if (!this.process || !this.process.stdin.writable) {
      throw new Error('Canon bridge process is not running or stdin not writable');
    }
    const line = JSON.stringify(cmd) + '\n';
    this.process.stdin.write(line);
  }

  handleBridgeEvent(event) {
    const { event: eventName } = event;
    if (!eventName) return;

    switch (eventName) {
      case 'bridgeReady':
        console.log('[CanonBridge] Native bridge ready:', event);
        this.emit('ready', event);
        break;

      case 'initialized':
        console.log('[CanonBridge] EDSDK initialized successfully');
        this.emit('initialized', event);
        break;

      case 'cameraDiscovered':
        this.enumerateInFlight = false;
        this.lastEnumEndAt = Date.now();
        this.lastEnumElapsedMs = this.lastEnumEndAt - (this.lastEnumBeginAt || this.lastEnumEndAt);
        this.lastEnumResult = 'EDS_ERR_OK';
        this.lastEnumCount = Number(event.count) || 0;
        this.cameraCount = this.lastEnumCount;
        this.cameraModel = event.model || this.cameraModel || 'Canon EOS 6D';
        if (this.lastEnumCount > 0) {
          this.state = 'CANON_PRESENT';
        } else {
          this.state = 'NO_CANON_DETECTED';
        }
        this.logEnumStatus({ ACTION: 'EVENT_DISCOVERED' });
        this.emit('cameraDiscovered', event);
        break;

      case 'sessionOpened':
        this.state = 'READY';
        this.cameraModel = event.model || this.cameraModel;
        console.log(`[CanonBridge] Session opened successfully on ${this.cameraModel}`);
        this.emit('stateChanged', { state: this.state });
        this.emit('sessionOpened', event);
        break;

      case 'liveViewStarted':
        this.state = 'LIVEVIEW';
        this.emit('stateChanged', { state: this.state });
        this.emit('liveViewStarted', event);
        break;

      case 'liveViewStopped':
        if (this.state === 'LIVEVIEW') this.state = 'READY';
        this.emit('stateChanged', { state: this.state });
        this.emit('liveViewStopped', event);
        break;

      case 'liveViewFrame':
        this.latestEvfFrame = event;
        this.emit('liveViewFrame', event);
        break;

      case 'captureStarted':
        this.state = 'CAPTURING';
        this.emit('stateChanged', { state: this.state });
        this.emit('captureStarted', event);
        break;

      case 'shutterDone':
        console.log('[CanonBridge] Physical shutter completed');
        this.emit('shutterDone', event);
        break;

      case 'objectCreated':
        this.state = 'DOWNLOADING';
        this.emit('stateChanged', { state: this.state });
        console.log(`[CanonBridge] Object created on camera: ${event.fileName} (${event.size} bytes)`);
        this.emit('objectCreated', event);
        break;

      case 'downloadCompleted':
        this.state = 'READY';
        this.emit('stateChanged', { state: this.state });
        console.log(`[CanonBridge] Download completed: ${event.path} (${event.size} bytes, ${event.width}x${event.height})`);
        if (this.currentPendingCapture) {
          this.currentPendingCapture.resolve(event);
          this.currentPendingCapture = null;
        }
        this.emit('downloadCompleted', event);
        break;

      case 'error':
        console.error('[CanonBridge] Bridge error event:', event);
        this.lastError = event.code || 'UNKNOWN_ERROR';
        if (event.code === 'OPEN_SESSION_FAILED' || event.code === 'INITIALIZE_FAILED') {
          this.state = 'ERROR';
          this.emit('stateChanged', { state: this.state });
        }
        if (this.currentPendingCapture) {
          this.currentPendingCapture.reject(new Error(`Canon capture error: ${event.code || 'UNKNOWN_ERROR'}`));
          this.currentPendingCapture = null;
        }
        this.emit('bridgeError', event);
        break;

      default:
        console.debug('[CanonBridge] Unhandled event:', event);
    }
  }

  async startLiveView() {
    if (this.state !== 'READY' && this.state !== 'LIVEVIEW') {
      const started = await this.start();
      if (!started) return false;
    }
    await this.sendCommand({ command: 'startLiveView' });
    return true;
  }

  async stopLiveView() {
    if (!this.process) return;
    try {
      await this.sendCommand({ command: 'stopLiveView' });
    } catch (e) {
      console.warn('[CanonBridge] stopLiveView error:', e);
    }
  }

  async capture({ sessionId, shotIndex, targetPath, timeoutMs = 15000 }) {
    if (!this.process || (this.state !== 'READY' && this.state !== 'LIVEVIEW')) {
      throw new Error(`Cannot capture: Canon bridge state is ${this.state}`);
    }

    if (this.currentPendingCapture) {
      throw new Error('Capture already in progress');
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.currentPendingCapture) {
          this.currentPendingCapture = null;
          reject(new Error(`Capture timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);

      this.currentPendingCapture = {
        resolve: (data) => {
          clearTimeout(timer);
          resolve(data);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
      };

      this.sendCommand({
        command: 'capture',
        sessionId,
        shotIndex,
        targetPath,
      }).catch((err) => {
        clearTimeout(timer);
        this.currentPendingCapture = null;
        reject(err);
      });
    });
  }

  async shutdown() {
    this.isShuttingDown = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.process) {
      try {
        await this.sendCommand({ command: 'shutdown' });
      } catch (e) {
        // ignore
      }
      setTimeout(() => {
        if (this.process) {
          try {
            this.process.kill('SIGTERM');
          } catch (e) {
            // ignore
          }
        }
      }, 500);
    }
  }
}

module.exports = { CanonCameraBridgeManager };
