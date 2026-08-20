const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const EventEmitter = require('events');

class CanonCameraBridgeManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = options;
    this.process = null;
    this.state = 'DISCONNECTED'; // DISCONNECTED | CONNECTING | READY | LIVEVIEW | CAPTURING | DOWNLOADING | ERROR
    this.cameraModel = null;
    this.cameraCount = 0;
    this.currentPendingCapture = null;
    this.latestEvfFrame = null;
    this.binaryPath = options.binaryPath || path.join(__dirname, 'canon', 'bin', 'canon_bridge_mac');
    this.reconnectTimer = null;
    this.isShuttingDown = false;
  }

  async start() {
    if (this.process) return true;
    if (!fs.existsSync(this.binaryPath)) {
      console.warn(`[CanonBridge] Binary not found at ${this.binaryPath}`);
      this.state = 'DISCONNECTED';
      return false;
    }

    this.state = 'CONNECTING';
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
        this.state = 'DISCONNECTED';
        this.emit('disconnected', { code });
        if (this.currentPendingCapture) {
          this.currentPendingCapture.reject(new Error(`Bridge closed unexpectedly with code ${code}`));
          this.currentPendingCapture = null;
        }
      });

      this.process.on('error', (err) => {
        console.error('[CanonBridge] Process error:', err);
        this.state = 'ERROR';
        this.emit('error', err);
      });

      // Send initialize command
      await this.sendCommand({ command: 'initialize' });
      await new Promise((r) => setTimeout(r, 200));

      // Send enumerate command
      await this.sendCommand({ command: 'enumerate' });
      await new Promise((r) => setTimeout(r, 300));

      if (this.cameraCount > 0) {
        // Send openSession command
        await this.sendCommand({ command: 'openSession' });
        this.state = 'READY';
        console.log(`[CanonBridge] Ready with camera: ${this.cameraModel}`);
        return true;
      } else {
        console.log('[CanonBridge] No Canon camera detected during enumeration');
        this.state = 'DISCONNECTED';
        return false;
      }
    } catch (err) {
      console.error('[CanonBridge] Failed to start bridge:', err);
      this.state = 'ERROR';
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
        break;

      case 'initialized':
        console.log('[CanonBridge] EDSDK initialized successfully');
        break;

      case 'cameraDiscovered':
        this.cameraCount = Number(event.count) || 0;
        this.cameraModel = event.model || 'Canon EOS';
        console.log(`[CanonBridge] Discovered ${this.cameraCount} camera(s): ${this.cameraModel}`);
        this.emit('cameraDiscovered', event);
        break;

      case 'sessionOpened':
        this.state = 'READY';
        this.cameraModel = event.model || this.cameraModel;
        console.log(`[CanonBridge] Session opened successfully on ${this.cameraModel}`);
        this.emit('sessionOpened', event);
        break;

      case 'liveViewStarted':
        this.state = 'LIVEVIEW';
        this.emit('liveViewStarted', event);
        break;

      case 'liveViewStopped':
        if (this.state === 'LIVEVIEW') this.state = 'READY';
        this.emit('liveViewStopped', event);
        break;

      case 'liveViewFrame':
        this.latestEvfFrame = event;
        this.emit('liveViewFrame', event);
        break;

      case 'captureStarted':
        this.state = 'CAPTURING';
        this.emit('captureStarted', event);
        break;

      case 'shutterDone':
        console.log('[CanonBridge] Physical shutter completed');
        this.emit('shutterDone', event);
        break;

      case 'objectCreated':
        this.state = 'DOWNLOADING';
        console.log(`[CanonBridge] Object created on camera: ${event.fileName} (${event.size} bytes)`);
        this.emit('objectCreated', event);
        break;

      case 'downloadCompleted':
        this.state = 'READY';
        console.log(`[CanonBridge] Download completed: ${event.path} (${event.size} bytes, ${event.width}x${event.height})`);
        if (this.currentPendingCapture) {
          this.currentPendingCapture.resolve(event);
          this.currentPendingCapture = null;
        }
        this.emit('downloadCompleted', event);
        break;

      case 'error':
        console.error('[CanonBridge] Bridge error event:', event);
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
    if (this.process) {
      try {
        await this.sendCommand({ command: 'closeSession' });
        await this.sendCommand({ command: 'shutdown' });
      } catch {
        // ignore
      }
      setTimeout(() => {
        if (this.process) this.process.kill('SIGTERM');
      }, 500);
    }
  }
}

module.exports = { CanonCameraBridgeManager };
