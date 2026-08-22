/**
 * Canon Camera Runtime Service (Node Process)
 * Owns the native EDSDK bridge lifecycle, Live View streaming,
 * high-res capture, JPEG download, and recovery.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { COMMANDS, EVENTS, STATES, createMessage } = require('./protocol.cjs');
const { resolveBridgeBinary, resolveEdsdkPath, checkSystemContention } = require('./lifecycle.cjs');

function auditMacOsUsb() {
  let macosUsbPresent = false;
  let vendorId = 'N/A';
  let productId = 'N/A';
  let productName = 'N/A';
  let locationId = 'N/A';
  let usbExclusiveOwner = 'N/A';

  try {
    const { execSync } = require('child_process');
    const out = execSync('ioreg -p IOUSB -w0 -l', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'], timeout: 2000 });
    const lines = out.split('\n');
    let inCanon = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/Canon|EOS|1193/i.test(line) && /IOUSBHostDevice|AppleUSB/i.test(line)) {
        inCanon = true;
        macosUsbPresent = true;
      }
      if (inCanon) {
        const vMatch = line.match(/"idVendor"\s*=\s*(\d+)/);
        if (vMatch) vendorId = vMatch[1] === '1193' ? '0x04A9 (Canon Inc.)' : vMatch[1];
        const pMatch = line.match(/"idProduct"\s*=\s*(\d+)/);
        if (pMatch) productId = pMatch[1] === '12880' ? '0x3250 (EOS 6D)' : pMatch[1];
        const nMatch = line.match(/"USB Product Name"\s*=\s*"([^"]+)"/);
        if (nMatch) productName = nMatch[1];
        const lMatch = line.match(/"locationID"\s*=\s*(\d+)/);
        if (lMatch) locationId = lMatch[1];
        const oMatch = line.match(/"UsbExclusiveOwner"\s*=\s*"([^"]+)"/);
        if (oMatch) usbExclusiveOwner = oMatch[1];
        if (line.includes('+-o ') && !line.includes('Canon')) {
          inCanon = false;
        }
      }
    }
  } catch (e) {
    // ignore
  }

  console.log(`[CANON_USB_NATIVE_AUDIT] macosUsbPresent=${macosUsbPresent} vendorId=${vendorId} productId=${productId} productName=${productName} locationId=${locationId} usbExclusiveOwner=${usbExclusiveOwner}`);
  return { macosUsbPresent, vendorId, productId, productName, locationId, usbExclusiveOwner };
}

function auditProcessOwners(bridgePid) {
  let canonRuntimeCount = 0;
  let canonBridgeCount = 0;
  let eosUtilityRunning = false;
  let ptpCameraRunning = false;

  try {
    const { execSync } = require('child_process');
    const out = execSync('ps -eo pid,comm', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'], timeout: 2000 });
    const lines = out.split('\n');
    for (const line of lines) {
      if (/canon-runtime/i.test(line)) canonRuntimeCount++;
      if (/canon_bridge_mac/i.test(line)) canonBridgeCount++;
      if (/EOS Utility|EOS Utility 3|EOS Utility Launcher/i.test(line)) eosUtilityRunning = true;
      if (/PTPCamera|ptpcamerad/i.test(line)) ptpCameraRunning = true;
    }
  } catch (e) {
    // ignore
  }

  console.log(`[CANON_OWNER_AUDIT] electronPid=${process.ppid} canonRuntimePid=${process.pid} canonBridgePid=${bridgePid || 'none'} canonRuntimeCount=${canonRuntimeCount} canonBridgeCount=${canonBridgeCount} eosUtilityRunning=${eosUtilityRunning} ptpCameraRunning=${ptpCameraRunning}`);
  return { canonRuntimeCount, canonBridgeCount, eosUtilityRunning, ptpCameraRunning };
}

class CanonRuntimeService {
  constructor() {
    this.state = STATES.DISCONNECTED;
    this.bridgeProcess = null;
    this.binaryInfo = resolveBridgeBinary();
    this.edsdkInfo = resolveEdsdkPath();
    this.cameraModel = null;
    this.cameraCount = 0;
    this.isShuttingDown = false;
    this.recovering = false;

    // EVF Performance & Bounded Backpressure metrics
    this.latestEvfFrame = null;
    this.evfPendingBroadcast = false;
    this.evfBroadcastTimer = null;
    this.evfSourceFrames = 0;
    this.evfBroadcastedFrames = 0;
    this.evfDroppedFrames = 0;
    this.evfTotalBytes = 0;
    this.evfStartTime = 0;
    this.evfFirstFrameReceived = false;

    // Capture correlation & pending state
    this.currentPendingCapture = null;

    // Enumerate tracking
    this.enumerateInFlight = false;
    this.lastEnumBeginAt = 0;
    // Bridge process lifecycle counters
    this.bridgeSpawnCount = 0;
    this.bridgeExitCount = 0;
    this.bridgeRestartCount = 0;

    console.log(`[CANON_RUNTIME_PROCESS]\npid = ${process.pid}\nppid = ${process.ppid}`);

    // Prevent orphaned background process: if parent died (reparented to launchd), exit immediately
    setInterval(() => {
      try {
        if (process.ppid === 1) {
          console.warn('[CanonRuntime] Parent process died (reparented to launchd). Terminating bridge and exiting.');
          if (this.bridgeProcess && !this.bridgeProcess.killed) {
            try { this.bridgeProcess.kill('SIGTERM'); } catch (e) {}
          }
          process.exit(0);
        }
      } catch (e) {}
    }, 2000);
  }

  setState(newState, extra = {}) {
    const oldState = this.state;
    this.state = newState;
    console.log(`[CANON_RUNTIME_STATE] ${oldState} -> ${newState}`, extra);
    this.emitToParent(EVENTS.STATE_CHANGED, {
      from: oldState,
      to: newState,
      cameraModel: this.cameraModel,
      cameraCount: this.cameraCount,
      ...extra,
    });
  }

  emitToParent(type, payload = {}) {
    if (process.send) {
      process.send(createMessage(type, payload));
    }
  }

  async start() {
    if (this.bridgeProcess && (this.state === STATES.READY || this.state === STATES.LIVEVIEW)) {
      return true;
    }
    if (!fs.existsSync(this.binaryInfo.path)) {
      console.error(`[CanonRuntime] Binary not found at: ${this.binaryInfo.path}`);
      this.setState(STATES.ERROR, { error: 'BINARY_NOT_FOUND', path: this.binaryInfo.path });
      return false;
    }

    this.setState(STATES.INITIALIZING);
    return this.spawnBridge();
  }

  async spawnBridge() {
    return new Promise((resolve) => {
      const binaryDir = path.dirname(this.binaryInfo.path);
      console.log(`[CanonRuntime] Spawning native bridge: ${this.binaryInfo.path} (cwd: ${binaryDir})`);

      this.bridgeProcess = spawn(this.binaryInfo.path, [], {
        cwd: binaryDir,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.bridgeSpawnCount++;
      console.log(`[CANON_BRIDGE_OWNER]\nbridgePid = ${this.bridgeProcess.pid}\nparentRuntimePid = ${process.pid}`);
      console.log(`[BRIDGE_LIFECYCLE]\naction=SPAWN\npid=${this.bridgeProcess.pid}\nruntimePid=${process.pid}`);

      let stdoutBuffer = '';
      this.bridgeProcess.stdout.on('data', (data) => {
        stdoutBuffer += data.toString();
        const lines = stdoutBuffer.split('\n');
        stdoutBuffer = lines.pop();

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

      this.bridgeProcess.stderr.on('data', (data) => {
        const text = data.toString().trim();
        if (text) console.debug('[CanonBridge stderr]', text);
      });

      this.bridgeProcess.on('close', (code, signal) => {
        this.bridgeExitCount++;
        console.log(`[BRIDGE_LIFECYCLE]\naction=EXIT\npid=${this.bridgeProcess?.pid || 'unknown'}\ncode=${code}\nsignal=${signal || 'none'}`);
        console.log(`[CanonRuntime] Bridge process closed with code ${code}`);
        this.bridgeProcess = null;
        this.enumerateInFlight = false;
        this.evfFirstFrameReceived = false;

        if (this.currentPendingCapture) {
          this.currentPendingCapture.reject(new Error(`Bridge closed unexpectedly with code ${code}`));
          this.currentPendingCapture = null;
        }

        if (!this.isShuttingDown) {
          this.setState(STATES.RECOVERING, { exitCode: code });
          this.emitToParent(EVENTS.DISCONNECTED, { exitCode: code });
          void this.recoverBridgeLevel3();
        } else {
          this.setState(STATES.DISCONNECTED);
        }
      });

      this.bridgeProcess.on('error', (err) => {
        console.error('[CanonRuntime] Bridge process error:', err);
        this.setState(STATES.ERROR, { error: err.message });
        this.emitToParent(EVENTS.ERROR, { error: err.message });
        resolve(false);
      });

      // Await bridgeReady event
      const onReady = async () => {
        console.log('[CanonRuntime] Native bridge ready. Initializing EDSDK...');
        auditMacOsUsb();
        auditProcessOwners(this.bridgeProcess?.pid);
        await this.sendCommand({ command: 'initialize' });
      };

      const onInitialized = async () => {
        console.log('[CanonRuntime] EDSDK initialized successfully. Discovering cameras with bounded retry on same bridge...');
        const hasCamera = await this.discoverCameraWithRetry();
        if (hasCamera) {
          const sessionOpened = await this.openSession();
          if (sessionOpened) {
            console.log('[CanonRuntime] Session opened on boot. Starting EVF to achieve CAMERA_WARM_READY...');
            await this.startLiveView();
            await this.waitForFirstEvfFrame(5000);
            resolve(true);
            return;
          }
          resolve(false);
        } else {
          console.warn('[CanonRuntime] Camera discovery exhausted on same bridge. State is CAMERA_NOT_FOUND.');
          resolve(false);
        }
      };

      this.onceBridgeEvent('bridgeReady', onReady);
      this.onceBridgeEvent('initialized', onInitialized);
    });
  }

  async discoverCameraWithRetry(maxAttempts = 4) {
    const backoffs = [1000, 2000, 3000, 5000];
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`[CanonRuntime] Enumerate attempt ${attempt}/${maxAttempts} on bridge PID ${this.bridgeProcess?.pid}...`);
      const count = await this.enumerate();
      if (count > 0) {
        console.log(`[CanonRuntime] Camera discovered on attempt ${attempt}: ${this.cameraModel} (count=${count})`);
        return true;
      }

      if (attempt < maxAttempts) {
        const waitMs = backoffs[attempt - 1] || 2000;
        this.setState(STATES.DISCOVERY_WAIT, { attempt, nextRetryInMs: waitMs });
        console.log(`[CanonRuntime] Count is 0 (SUCCESS_EMPTY_LIST). State = DISCOVERY_WAIT. Retrying same bridge in ${waitMs}ms...`);
        await new Promise((r) => setTimeout(r, waitMs));
      }
    }

    this.setState(STATES.CAMERA_NOT_FOUND, { totalAttempts: maxAttempts });
    return false;
  }

  async waitForFirstEvfFrame(timeoutMs = 5000) {
    if (this.evfFirstFrameReceived && this.latestEvfFrame) {
      return true;
    }
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        cleanup();
        resolve(this.evfFirstFrameReceived);
      }, timeoutMs);

      const onFrame = (evt) => {
        if (evt.dataUrl || evt.seq) {
          cleanup();
          resolve(true);
        }
      };

      const cleanup = () => {
        clearTimeout(timer);
        this.removeBridgeEventListener(onFrame);
      };

      this.addBridgeEventListener(onFrame);
    });
  }

  onceBridgeEvent(targetEvent, callback) {
    const handler = (event) => {
      if (event.event === targetEvent) {
        this.removeBridgeEventListener(handler);
        callback(event);
      }
    };
    this.addBridgeEventListener(handler);
  }

  addBridgeEventListener(fn) {
    if (!this._bridgeListeners) this._bridgeListeners = [];
    this._bridgeListeners.push(fn);
  }

  removeBridgeEventListener(fn) {
    if (!this._bridgeListeners) return;
    this._bridgeListeners = this._bridgeListeners.filter((l) => l !== fn);
  }

  handleBridgeEvent(event) {
    if (this._bridgeListeners) {
      const listeners = [...this._bridgeListeners];
      for (const l of listeners) {
        try { l(event); } catch (e) { console.error(e); }
      }
    }

    const { event: eventName } = event;
    if (!eventName) return;

    switch (eventName) {
      case 'bridgeReady':
        this.emitToParent(EVENTS.RUNTIME_READY, {
          platform: event.platform || process.platform,
          arch: event.arch || process.arch,
          binarySource: this.binaryInfo.source,
          edsdkSource: this.edsdkInfo.source,
        });
        break;

      case 'initialized':
        this.emitToParent(EVENTS.INITIALIZED, { status: 'ok' });
        break;

      case 'cameraDiscovered':
        this.enumerateInFlight = false;
        this.lastEnumEndAt = Date.now();
        this.cameraCount = Number(event.count) || 0;
        this.cameraModel = event.model || (this.cameraCount > 0 ? 'Canon EOS 6D' : null);
        this.lastEnumResult = 'EDS_ERR_OK';

        this.emitToParent(EVENTS.DISCOVERED, {
          count: this.cameraCount,
          model: this.cameraModel,
          port: event.port || 'USB',
          elapsedMs: this.lastEnumEndAt - this.lastEnumBeginAt,
        });
        break;

      case 'sessionOpened':
        this.cameraModel = event.model || this.cameraModel || 'Canon EOS 6D';
        this.setState(STATES.READY, { cameraModel: this.cameraModel });
        this.emitToParent(EVENTS.SESSION_OPENED, {
          model: this.cameraModel,
          status: 'ok',
        });
        break;

      case 'liveViewStarted':
        this.liveViewActive = true;
        this.setState(STATES.STARTING_LIVEVIEW);
        this.evfStartTime = Date.now();
        this.evfSourceFrames = 0;
        this.evfBroadcastedFrames = 0;
        this.evfDroppedFrames = 0;
        this.evfTotalBytes = 0;
        this.evfFirstFrameReceived = false;
        this.emitToParent(EVENTS.LIVEVIEW_STARTED, { status: 'ok' });
        break;

      case 'liveViewResumed':
        this.liveViewActive = true;
        this.setState(STATES.RESUMING_LIVEVIEW);
        this.emitToParent(EVENTS.LIVEVIEW_RESUMED, { status: 'ok' });
        break;

      case 'liveViewStopped':
        this.liveViewActive = false;
        if (this.state === STATES.LIVEVIEW || this.state === STATES.STARTING_LIVEVIEW || this.state === STATES.RESUMING_LIVEVIEW) {
          this.setState(STATES.READY);
        }
        this.emitToParent(EVENTS.LIVEVIEW_STOPPED, { status: 'ok' });
        break;

      case 'liveViewFrame':
        this.handleEvfFrame(event);
        break;

      case 'captureStarted':
        this.setState(STATES.CAPTURING);
        this.emitToParent(EVENTS.CAPTURE_STARTED, {
          shotIndex: event.shotIndex,
          correlationId: this.currentPendingCapture?.correlationId,
        });
        break;

      case 'shutterDone':
        this.emitToParent(EVENTS.SHUTTER, {
          status: 'ok',
          correlationId: this.currentPendingCapture?.correlationId,
        });
        break;

      case 'objectCreated':
        this.setState(STATES.DOWNLOADING);
        this.emitToParent(EVENTS.OBJECT_CREATED, {
          fileName: event.fileName,
          size: event.size,
          correlationId: this.currentPendingCapture?.correlationId,
        });
        break;

      case 'downloadCompleted':
        if (this.liveViewActive) {
          this.setState(STATES.RESUMING_LIVEVIEW);
        } else {
          this.setState(STATES.READY);
        }
        if (this.currentPendingCapture) {
          const cap = this.currentPendingCapture;
          this.currentPendingCapture = null;
          const result = {
            path: event.path,
            size: event.size,
            width: event.width,
            height: event.height,
            correlationId: cap.correlationId,
            shotIndex: cap.shotIndex,
            sessionId: cap.sessionId,
          };
          this.emitToParent(EVENTS.DOWNLOAD_COMPLETED, result);
          cap.resolve(result);
        }
        break;

      case 'error':
        console.error('[CanonRuntime] Native error event:', event);
        this.emitToParent(EVENTS.ERROR, {
          code: event.code || 'UNKNOWN_ERROR',
          edsdkError: event.edsdkError,
        });
        if (this.currentPendingCapture) {
          this.currentPendingCapture.reject(new Error(`Canon capture error: ${event.code || 'UNKNOWN_ERROR'}`));
          this.currentPendingCapture = null;
        }
        break;
    }
  }

  /**
   * "LATEST_FRAME_WINS" High Performance EVF Dispatcher
   * Bounded backpressure queue size = 1. Drops stale frames if broadcast in flight.
   */
  handleEvfFrame(frame) {
    this.evfSourceFrames++;
    this.evfTotalBytes += frame.size || 0;
    this.lastEvfFrameAt = Date.now();
    this.lastEvfSeq = frame.seq || (this.lastEvfSeq ? this.lastEvfSeq + 1 : 1);

    // Set LIVEVIEW state authoritative on first real EVF frame or when resuming
    if (
      !this.evfFirstFrameReceived ||
      this.state === STATES.RESUMING_LIVEVIEW ||
      this.state === STATES.STARTING_LIVEVIEW ||
      this.state === STATES.READY ||
      this.state === STATES.LIVEVIEW_STALLED ||
      this.state === STATES.LIVEVIEW_RECOVERING
    ) {
      this.evfFirstFrameReceived = true;
      this.setState(STATES.LIVEVIEW, {
        firstFrameSeq: frame.seq,
        width: frame.width,
        height: frame.height,
      });
    }

    this.latestEvfFrame = frame;

    if (!this.evfPendingBroadcast) {
      this.evfPendingBroadcast = true;
      // Target ~30 UI FPS (33ms throttle)
      setImmediate(() => {
        if (this.latestEvfFrame) {
          const toSend = this.latestEvfFrame;
          this.latestEvfFrame = null;
          this.evfBroadcastedFrames++;
          this.emitToParent(EVENTS.LIVEVIEW_FRAME, {
            seq: toSend.seq,
            dataUrl: toSend.dataUrl,
            width: toSend.width,
            height: toSend.height,
            size: toSend.size,
          });
        }
        this.evfPendingBroadcast = false;
      });
    } else {
      this.evfDroppedFrames++;
    }
  }

  waitForBridgeEvent(targetEvent, timeoutMs = 25000) {
    return new Promise((resolve) => {
      let timer = null;
      const handler = (evt) => {
        if (evt && evt.event === targetEvent) {
          if (timer) clearTimeout(timer);
          this.removeBridgeEventListener(handler);
          resolve(evt);
        }
      };

      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          this.removeBridgeEventListener(handler);
          resolve(null);
        }, timeoutMs);
      }

      this.addBridgeEventListener(handler);
    });
  }

  canPerformStaleLockRecovery() {
    if (!this.abnormalPredecessorConfirmed) {
      return false;
    }
    const audit = auditProcessOwners(this.bridgeProcess?.pid);
    if (audit.eosUtilityRunning || audit.ptpCameraRunning || audit.canonBridgeCount > 1) {
      console.warn('[CanonRuntime] Refusing stale lock cleanup due to active camera daemon or second bridge.');
      return false;
    }
    return true;
  }

  async sendCommand(cmd) {
    if (!this.bridgeProcess || !this.bridgeProcess.stdin.writable) {
      throw new Error('Bridge process is not running or stdin not writable');
    }
    return new Promise((resolve) => {
      this.bridgeProcess.stdin.write(JSON.stringify(cmd) + '\n', resolve);
    });
  }

  async enumerate() {
    if (this.enumerateInFlight) return 0;
    this.enumerateInFlight = true;
    this.lastEnumBeginAt = Date.now();
    this.setState(STATES.ENUMERATING);

    try {
      // 1. Attach listener FIRST before sending command to prevent command/event race
      const discoveredPromise = this.waitForBridgeEvent('cameraDiscovered', 25000);
      await this.sendCommand({ command: 'enumerate' });
      const evt = await discoveredPromise;

      const count = Number(evt?.count) || 0;
      this.cameraCount = count;
      if (evt?.model) this.cameraModel = evt.model;
      this.lastEnumEndAt = Date.now();
      this.lastEnumResult = count > 0 ? 'EDS_ERR_OK' : 'SUCCESS_EMPTY_LIST';
      return count;
    } finally {
      this.enumerateInFlight = false;
    }
  }

  async openSession() {
    this.setState(STATES.OPENING_SESSION);
    console.log(`[CanonRuntime] Opening session with camera: ${this.cameraModel}`);

    // 1. Attach listener FIRST before sending command
    const sessionPromise = this.waitForBridgeEvent('sessionOpened', 3500);
    await this.sendCommand({ command: 'openSession' });
    const evt = await sessionPromise;
    const opened = Boolean(evt);

    if (opened) {
      this.setState(STATES.CONFIGURING);
      this.setState(STATES.READY);
      return true;
    }

    if (!opened && this.state !== STATES.READY && this.state !== STATES.LIVEVIEW) {
      if (checkSystemContention()) {
        console.warn('[CanonRuntime] OpenSession contention detected with macOS photo/camera daemons.');
        this.setState(STATES.ERROR, { error: 'CAMERA_BUSY_CONTENTION' });
        return false;
      }

      if (this.canPerformStaleLockRecovery()) {
        console.log('[CanonRuntime] Abnormal predecessor confirmed. Executing safe stale lock recovery...');
        const cleanPromise = this.waitForBridgeEvent('staleLockCleaned', 2000);
        await this.sendCommand({ command: 'cleanStaleLock' });
        await cleanPromise;

        const retryPromise = this.waitForBridgeEvent('sessionOpened', 3000);
        await this.sendCommand({ command: 'openSession' });
        const retryEvt = await retryPromise;
        if (retryEvt) {
          this.setState(STATES.CONFIGURING);
          this.setState(STATES.READY);
          return true;
        }
      } else {
        console.warn('[CanonRuntime] OpenSession timeout/failed. STALE_LOCK_CLEANUP_ALLOWED = NO.');
      }
      return false;
    }
    return true;
  }

  async startLiveView() {
    if (this.state !== STATES.READY && this.state !== STATES.LIVEVIEW) {
      const ok = await this.start();
      if (!ok) return false;
    }
    await this.sendCommand({ command: 'startLiveView' });
    return true;
  }

  async stopLiveView() {
    if (!this.bridgeProcess) return;
    try {
      await this.sendCommand({ command: 'stopLiveView' });
    } catch (e) {}
  }

  async capture({ sessionId, shotIndex, targetPath, correlationId, timeoutMs = 15000 }) {
    if (!this.bridgeProcess || (this.state !== STATES.READY && this.state !== STATES.LIVEVIEW && this.state !== STATES.STARTING_LIVEVIEW && this.state !== STATES.RESUMING_LIVEVIEW)) {
      throw new Error(`Cannot capture: Canon runtime state is ${this.state}`);
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
        sessionId,
        shotIndex,
        targetPath,
        correlationId: correlationId || `${sessionId}_shot_${shotIndex}_${Date.now()}`,
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

  /**
   * LEVEL 1 — EVF RECOVERY (In-Session Recovery)
   * Reasserts EVF_OutputDevice and resumes EVF without enumerate or bridge restart.
   */
  async recoverLiveViewLevel1() {
    if (!this.bridgeProcess || this.bridgeProcess.killed) return false;
    if (this.state === STATES.CAPTURING || this.state === STATES.DOWNLOADING) {
      console.log('[CanonRuntime] Level 1 recovery skipped: capture/download in progress');
      return false;
    }

    console.log('[CanonRuntime] Executing LEVEL 1 EVF Recovery (in-session)...');
    this.setState(STATES.LIVEVIEW_RECOVERING);

    const initialSeq = this.latestEvfFrame?.seq || 0;
    try {
      await this.sendCommand({ command: 'startLiveView' });
    } catch (e) {
      console.warn('[CanonRuntime] Level 1 send startLiveView failed:', e.message);
    }

    // Wait up to 3.5s for a new EVF frame (newSeq > initialSeq)
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        cleanup();
        console.warn('[CanonRuntime] Level 1 EVF Recovery timed out (no new frames)');
        resolve(false);
      }, 3500);

      const onFrame = (evt) => {
        if (evt.seq && evt.seq > initialSeq) {
          cleanup();
          console.log(`[CanonRuntime] Level 1 EVF Recovery SUCCEEDED with new frame seq=${evt.seq}`);
          resolve(true);
        }
      };

      const cleanup = () => {
        clearTimeout(timeout);
        this.removeBridgeEventListener(onFrame);
      };

      this.addBridgeEventListener(onFrame);
    });
  }

  /**
   * LEVEL 2 — SESSION RECOVERY (Clean Session Re-open on SAME bridge)
   */
  async recoverSessionLevel2() {
    if (!this.bridgeProcess || this.bridgeProcess.killed || this.bridgeRestartInFlight) return false;
    if (this.state === STATES.CAPTURING || this.state === STATES.DOWNLOADING) return false;

    console.log('[CanonRuntime] Executing LEVEL 2 Session Recovery (same bridge)...');
    this.setState(STATES.RECOVERING, { level: 2, action: 'SESSION_RECOVER' });

    try {
      await this.sendCommand({ command: 'stopLiveView' }).catch(() => {});
      await this.sendCommand({ command: 'closeSession' }).catch(() => {});
      await new Promise((r) => setTimeout(r, 300));

      const hasCamera = await this.enumerate();
      if (!hasCamera) {
        console.warn('[CanonRuntime] Level 2 session recovery: enumeration returned 0 cameras');
        return false;
      }

      await this.openSession();
      if (this.liveViewActive) {
        await this.startLiveView();
      }
      console.log('[CanonRuntime] Level 2 Session Recovery SUCCEEDED');
      return true;
    } catch (e) {
      console.error('[CanonRuntime] Level 2 session recovery failed:', e.message);
      return false;
    }
  }

  /**
   * LEVEL 3 — BRIDGE RECOVERY (Process Respawn with Strict Invariant Guard)
   */
  async recoverBridgeLevel3() {
    if (this.bridgeRestartInFlight) {
      console.log('[CanonRuntime] Level 3 bridge recovery already in flight. Skipping duplicate call.');
      return false;
    }
    this.bridgeRestartInFlight = true;

    if (!this.recoveryAttempts) this.recoveryAttempts = 0;
    const maxAttempts = 3;

    if (this.recoveryAttempts >= maxAttempts) {
      console.error(`[CanonRuntime] Max bridge recovery attempts (${maxAttempts}) reached. Entering terminal ERROR.`);
      this.setState(STATES.ERROR, { error: 'CANON_TERMINAL_RECOVERY_EXHAUSTED' });
      this.bridgeRestartInFlight = false;
      return false;
    }

    this.recoveryAttempts++;
    const backoffMs = this.recoveryAttempts === 1 ? 1500 : (this.recoveryAttempts === 2 ? 3000 : 5000);
    console.log(`[CanonRuntime] Executing LEVEL 3 Bridge Recovery (attempt ${this.recoveryAttempts}/${maxAttempts}, backoff ${backoffMs}ms)...`);

    const oldPid = this.bridgeProcess ? this.bridgeProcess.pid : null;
    console.log(`[CanonRuntime] OLD_BRIDGE_PID = ${oldPid || 'NONE'}`);

    // 1. Graceful shutdown
    if (this.bridgeProcess) {
      try {
        await this.sendCommand({ command: 'shutdown' });
      } catch (e) {}

      await new Promise((resolve) => {
        const checkExitTimer = setTimeout(() => {
          if (this.bridgeProcess) {
            try { this.bridgeProcess.kill('SIGKILL'); } catch (e) {}
          }
          resolve();
        }, 500);

        if (!this.bridgeProcess) {
          clearTimeout(checkExitTimer);
          resolve();
        } else {
          this.bridgeProcess.once('close', () => {
            clearTimeout(checkExitTimer);
            resolve();
          });
        }
      });
      this.bridgeProcess = null;
    }

    console.log('[CanonRuntime] OLD_BRIDGE_EXITED = YES');

    // 2. Reset stale session state
    this.cameraCount = 0;
    this.cameraModel = null;
    this.evfFirstFrameReceived = false;
    this.latestEvfFrame = null;
    this.setState(STATES.RECOVERING, { level: 3, attempt: this.recoveryAttempts });

    // 3. Backoff wait
    await new Promise((r) => setTimeout(r, backoffMs));

    // 4. Spawn exactly ONE new bridge
    try {
      const ok = await this.spawnBridge();
      console.log(`[CanonRuntime] NEW_BRIDGE_PID = ${this.bridgeProcess ? this.bridgeProcess.pid : 'FAILED'}`);
      if (ok) {
        this.recoveryAttempts = 0;
        if (this.liveViewActive) {
          await this.startLiveView();
        }
      }
      return ok;
    } catch (err) {
      console.error('[CanonRuntime] Level 3 bridge respawn failed:', err.message);
      return false;
    } finally {
      this.bridgeRestartInFlight = false;
    }
  }

  getMetrics() {
    const elapsedSec = (Date.now() - (this.evfStartTime || Date.now())) / 1000 || 1;
    const evfAgeMs = this.lastEvfFrameAt > 0 ? Date.now() - this.lastEvfFrameAt : 0;
    return {
      state: this.state,
      cameraModel: this.cameraModel,
      cameraCount: this.cameraCount,
      lastEvfSeq: this.lastEvfSeq || 0,
      lastEvfFrameAt: this.lastEvfFrameAt || 0,
      evfAgeMs,
      EVF_SOURCE_FPS: (this.evfSourceFrames / elapsedSec).toFixed(1),
      EVF_TARGET_UI_FPS: (this.evfBroadcastedFrames / elapsedSec).toFixed(1),
      EVF_AVG_FRAME_BYTES: this.evfSourceFrames > 0 ? Math.round(this.evfTotalBytes / this.evfSourceFrames) : 0,
      EVF_QUEUE_MAX: 1,
      EVF_QUEUE_PEAK: 1,
      EVF_DROPPED_FRAMES: this.evfDroppedFrames,
      isWarm: this.state === STATES.LIVEVIEW && evfAgeMs < 3000,
    };
  }

  async shutdown() {
    this.isShuttingDown = true;
    if (this.bridgeProcess) {
      try {
        await this.sendCommand({ command: 'shutdown' });
      } catch (e) {}
      setTimeout(() => {
        if (this.bridgeProcess) {
          try { this.bridgeProcess.kill('SIGTERM'); } catch (e) {}
        }
      }, 300);
    }
  }
}

// Instantiate and bind IPC message receiver
const service = new CanonRuntimeService();

process.on('message', async (msg) => {
  if (!msg || !msg.type) return;
  const { type, requestId } = msg;

  try {
    switch (type) {
      case COMMANDS.INITIALIZE:
      case COMMANDS.OPEN: {
        const ok = await service.start();
        service.emitToParent(EVENTS.STATE_CHANGED, { requestId, ok, state: service.state });
        break;
      }
      case COMMANDS.ENUMERATE: {
        const hasCamera = await service.enumerate();
        service.emitToParent(EVENTS.DISCOVERED, { requestId, hasCamera, count: service.cameraCount, model: service.cameraModel });
        break;
      }
      case COMMANDS.LIVEVIEW_START: {
        const ok = await service.startLiveView();
        service.emitToParent(EVENTS.LIVEVIEW_STARTED, { requestId, ok });
        break;
      }
      case COMMANDS.LIVEVIEW_STOP: {
        await service.stopLiveView();
        service.emitToParent(EVENTS.LIVEVIEW_STOPPED, { requestId, ok: true });
        break;
      }
      case COMMANDS.CAPTURE: {
        const result = await service.capture(msg);
        service.emitToParent(EVENTS.DOWNLOAD_COMPLETED, { requestId, ...result });
        break;
      }
      case COMMANDS.RECOVER_EVF: {
        const ok = await service.recoverLiveViewLevel1();
        service.emitToParent(EVENTS.STATE_CHANGED, { requestId, ok, state: service.state });
        break;
      }
      case COMMANDS.RECOVER_SESSION: {
        const ok = await service.recoverSessionLevel2();
        service.emitToParent(EVENTS.STATE_CHANGED, { requestId, ok, state: service.state });
        break;
      }
      case COMMANDS.RECOVER_BRIDGE: {
        const ok = await service.recoverBridgeLevel3();
        service.emitToParent(EVENTS.STATE_CHANGED, { requestId, ok, state: service.state });
        break;
      }
      case COMMANDS.STATUS: {
        service.emitToParent(EVENTS.STATE_CHANGED, { requestId, metrics: service.getMetrics() });
        break;
      }
      case COMMANDS.SHUTDOWN: {
        await service.shutdown();
        process.exit(0);
        break;
      }
    }
  } catch (err) {
    service.emitToParent(EVENTS.ERROR, {
      requestId,
      error: err.message,
      state: service.state,
    });
  }
});

process.on('SIGTERM', async () => {
  await service.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await service.shutdown();
  process.exit(0);
});

// Auto-start bridge on launch
void service.start();
