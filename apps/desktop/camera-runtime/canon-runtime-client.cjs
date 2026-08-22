/**
 * Canon Runtime Client (Electron Main Layer)
 * Manages the isolated child process (canon-runtime.cjs), provides
 * async command correlation, event relaying, and automatic process recovery.
 */

const { fork } = require('child_process');
const path = require('path');
const EventEmitter = require('events');
const { COMMANDS, EVENTS, STATES } = require('./protocol.cjs');

class CanonRuntimeClient extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = options;
    this.runtimeScript = options.runtimeScript || path.join(__dirname, 'canon-runtime.cjs');
    this.process = null;
    this.state = STATES.DISCONNECTED;
    this.cameraModel = null;
    this.cameraCount = 0;
    this.isShuttingDown = false;
    this.reconnectTimer = null;
    this.requestSeq = 0;
    this.pendingRequests = new Map();
    this.latestEvfFrame = null;
  }

  get isRunning() {
    return Boolean(this.process && !this.process.killed);
  }

  async start() {
    if (this.isRunning && (this.state === STATES.READY || this.state === STATES.LIVEVIEW)) {
      return true;
    }

    if (this.isRunning) {
      return new Promise((resolve) => {
        if (this.state === STATES.READY || this.state === STATES.LIVEVIEW) {
          resolve(true);
        } else {
          const onState = (evt) => {
            if (evt.to === STATES.READY || evt.to === STATES.LIVEVIEW) {
              this.removeListener('stateChanged', onState);
              resolve(true);
            }
          };
          this.on('stateChanged', onState);
          setTimeout(() => {
            this.removeListener('stateChanged', onState);
            resolve(this.state === STATES.READY || this.state === STATES.LIVEVIEW);
          }, 8000);
        }
      });
    }

    return this.spawnRuntimeProcess();
  }

  async spawnRuntimeProcess() {
    return new Promise((resolve) => {
      console.log(`[CanonRuntimeClient] Forking Canon runtime process: ${this.runtimeScript}`);

      this.process = fork(this.runtimeScript, [], {
        stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      });

      console.log(`[CANON_RUNTIME_OWNER]\nruntimePid = ${this.process.pid}\nparentElectronPid = ${process.pid}`);

      const cleanExit = () => {
        this.isShuttingDown = true;
        if (this.process && !this.process.killed) {
          try { this.process.kill('SIGTERM'); } catch (e) {}
        }
      };
      process.once('exit', cleanExit);
      process.once('SIGINT', cleanExit);
      process.once('SIGTERM', cleanExit);

      this.process.stdout.on('data', (data) => {
        const text = data.toString().trim();
        if (text) console.log(`[CanonRuntime stdout] ${text}`);
      });

      this.process.stderr.on('data', (data) => {
        const text = data.toString().trim();
        if (text) console.warn(`[CanonRuntime stderr] ${text}`);
      });

      this.process.on('message', (msg) => {
        this.handleRuntimeMessage(msg);
      });

      this.process.on('close', (code) => {
        console.warn(`[CanonRuntimeClient] Runtime child process exited with code ${code}`);
        this.process = null;
        const prevState = this.state;
        this.state = STATES.DISCONNECTED;
        this.emit('disconnected', { code });
        this.emit('stateChanged', { from: prevState, to: STATES.DISCONNECTED, code });

        if (!this.isShuttingDown) {
          console.log('[CanonRuntimeClient] Unexpected runtime exit. Triggering recovery in 2s...');
          setTimeout(() => {
            if (!this.isShuttingDown) void this.start();
          }, 2000);
        }
      });

      this.process.on('error', (err) => {
        console.error('[CanonRuntimeClient] Runtime process error:', err);
        this.emit('error', err);
      });

      // Await initial ready or sessionOpened event
      const onSessionOpened = () => {
        this.removeListener('sessionOpened', onSessionOpened);
        this.removeListener('stateChanged', onInitialState);
        resolve(true);
      };

      const onInitialState = (evt) => {
        if (evt.to === STATES.READY || evt.to === STATES.LIVEVIEW) {
          this.removeListener('sessionOpened', onSessionOpened);
          this.removeListener('stateChanged', onInitialState);
          resolve(true);
        }
      };

      this.once('sessionOpened', onSessionOpened);
      this.on('stateChanged', onInitialState);

      setTimeout(() => {
        this.removeListener('sessionOpened', onSessionOpened);
        this.removeListener('stateChanged', onInitialState);
        resolve(this.state === STATES.READY || this.state === STATES.LIVEVIEW || this.cameraCount > 0);
      }, 10000);
    });
  }

  setState(newState, extra = {}) {
    const previousState = this.state;
    if (previousState === newState && !extra.force) return;
    this.state = newState;
    this.emit('stateChanged', {
      from: previousState,
      to: newState,
      cameraModel: this.cameraModel,
      cameraCount: this.cameraCount,
      ...extra,
    });
  }

  handleRuntimeMessage(msg) {
    if (!msg || !msg.type) return;

    // Resolve any correlated pending request
    if (msg.requestId && this.pendingRequests.has(msg.requestId)) {
      const { resolve, reject } = this.pendingRequests.get(msg.requestId);
      this.pendingRequests.delete(msg.requestId);
      if (msg.type === EVENTS.ERROR) {
        reject(new Error(msg.error || 'Runtime error'));
      } else {
        resolve(msg);
      }
    }

    switch (msg.type) {
      case EVENTS.RUNTIME_READY:
        this.emit('runtimeReady', msg);
        break;

      case EVENTS.INITIALIZED:
        this.emit('initialized', msg);
        break;

      case EVENTS.DISCOVERED:
        this.cameraCount = Number(msg.count) || 0;
        this.cameraModel = msg.model || this.cameraModel;
        this.emit('cameraDiscovered', msg);
        break;

      case EVENTS.SESSION_OPENED:
        this.cameraModel = msg.model || this.cameraModel;
        this.setState(STATES.READY, { model: this.cameraModel });
        this.emit('sessionOpened', msg);
        break;

      case EVENTS.LIVEVIEW_STARTED:
        this.setState(STATES.STARTING_LIVEVIEW);
        this.emit('liveViewStarted', msg);
        break;

      case EVENTS.LIVEVIEW_RESUMED:
        this.setState(STATES.RESUMING_LIVEVIEW);
        this.emit('liveViewResumed', msg);
        break;

      case EVENTS.LIVEVIEW_STOPPED:
        this.setState(STATES.READY);
        this.emit('liveViewStopped', msg);
        break;

      case EVENTS.LIVEVIEW_FRAME:
        this.latestEvfFrame = msg;
        if (
          this.state === STATES.STARTING_LIVEVIEW ||
          this.state === STATES.RESUMING_LIVEVIEW ||
          this.state === STATES.READY ||
          this.state === STATES.LIVEVIEW_STALLED ||
          this.state === STATES.LIVEVIEW_RECOVERING
        ) {
          this.setState(STATES.LIVEVIEW);
        }
        this.emit('liveViewFrame', msg);
        break;

      case EVENTS.CAPTURE_STARTED:
        this.setState(STATES.CAPTURING);
        this.emit('captureStarted', msg);
        break;

      case EVENTS.SHUTTER:
        this.emit('shutterDone', msg);
        break;

      case EVENTS.OBJECT_CREATED:
        this.setState(STATES.DOWNLOADING);
        this.emit('objectCreated', msg);
        break;

      case EVENTS.DOWNLOAD_COMPLETED:
        this.setState(STATES.RESUMING_LIVEVIEW);
        this.emit('downloadCompleted', msg);
        break;

      case EVENTS.STATE_CHANGED:
        if (msg.cameraModel) this.cameraModel = msg.cameraModel;
        if (typeof msg.cameraCount === 'number') this.cameraCount = msg.cameraCount;
        if (msg.to && msg.to !== this.state) {
          const prevState = this.state;
          this.state = msg.to;
          this.emit('stateChanged', { from: msg.from || prevState, to: msg.to, ...msg });
        } else {
          this.emit('stateChanged', msg);
        }
        break;

      case EVENTS.DISCONNECTED:
        this.setState(STATES.DISCONNECTED);
        this.emit('disconnected', msg);
        break;

      case EVENTS.ERROR:
        this.emit('bridgeError', msg);
        if (this.listenerCount('error') > 0) {
          this.emit('error', msg);
        }
        break;
    }
  }

  async sendRequest(type, payload = {}, timeoutMs = 25000) {
    if (!this.isRunning) {
      await this.start();
    }
    if (!this.process || !this.process.connected) {
      throw new Error('Canon runtime process is not connected');
    }

    this.requestSeq++;
    const requestId = `req_${Date.now()}_${this.requestSeq}`;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error(`Runtime command ${type} timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);

      this.pendingRequests.set(requestId, {
        resolve: (val) => {
          clearTimeout(timer);
          resolve(val);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
      });

      this.process.send({
        type,
        requestId,
        ...payload,
      });
    });
  }

  async enumerate() {
    return this.sendRequest(COMMANDS.ENUMERATE);
  }

  async openSession() {
    return this.sendRequest(COMMANDS.OPEN);
  }

  async startLiveView() {
    return this.sendRequest(COMMANDS.LIVEVIEW_START);
  }

  async stopLiveView() {
    return this.sendRequest(COMMANDS.LIVEVIEW_STOP);
  }

  async recoverLiveViewLevel1() {
    return this.sendRequest(COMMANDS.RECOVER_EVF, {}, 5000);
  }

  async recoverSessionLevel2() {
    return this.sendRequest(COMMANDS.RECOVER_SESSION, {}, 10000);
  }

  async recoverBridgeLevel3() {
    return this.sendRequest(COMMANDS.RECOVER_BRIDGE, {}, 15000);
  }

  async capture({ sessionId, shotIndex, targetPath, correlationId, timeoutMs = 20000 }) {
    return this.sendRequest(
      COMMANDS.CAPTURE,
      { sessionId, shotIndex, targetPath, correlationId },
      timeoutMs
    );
  }

  async getStatus() {
    return this.sendRequest(COMMANDS.STATUS, {}, 3000);
  }

  async shutdown() {
    this.isShuttingDown = true;
    if (this.process && this.process.connected) {
      try {
        await this.sendRequest(COMMANDS.SHUTDOWN, {}, 1000);
      } catch (e) {}
      setTimeout(() => {
        if (this.process) {
          try { this.process.kill('SIGTERM'); } catch (e) {}
        }
      }, 200);
    }
  }
}

module.exports = { CanonRuntimeClient };
