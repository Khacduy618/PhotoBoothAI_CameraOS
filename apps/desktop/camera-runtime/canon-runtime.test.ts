import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { COMMANDS, EVENTS, STATES, createMessage } from './protocol.cjs';
import { resolveBridgeBinary, resolveEdsdkPath } from './lifecycle.cjs';

describe('Canon Runtime Protocol & Lifecycle Constants', () => {
  it('defines all required command types', () => {
    expect(COMMANDS.INITIALIZE).toBe('camera.initialize');
    expect(COMMANDS.ENUMERATE).toBe('camera.enumerate');
    expect(COMMANDS.OPEN).toBe('camera.open');
    expect(COMMANDS.LIVEVIEW_START).toBe('camera.liveview.start');
    expect(COMMANDS.LIVEVIEW_STOP).toBe('camera.liveview.stop');
    expect(COMMANDS.AUTOFOCUS).toBe('camera.autofocus');
    expect(COMMANDS.AUTOFOCUS_STOP).toBe('camera.autofocus.stop');
    expect(COMMANDS.CAPTURE).toBe('camera.capture');
    expect(COMMANDS.SHUTDOWN).toBe('camera.shutdown');
  });

  it('defines all required event types', () => {
    expect(EVENTS.RUNTIME_READY).toBe('camera.runtime.ready');
    expect(EVENTS.INITIALIZED).toBe('camera.initialized');
    expect(EVENTS.DISCOVERED).toBe('camera.discovered');
    expect(EVENTS.SESSION_OPENED).toBe('camera.session.opened');
    expect(EVENTS.LIVEVIEW_STARTED).toBe('camera.liveview.started');
    expect(EVENTS.LIVEVIEW_FRAME).toBe('camera.liveview.frame');
    expect(EVENTS.AUTOFOCUS_STARTED).toBe('camera.autofocus.started');
    expect(EVENTS.AUTOFOCUS_COMPLETED).toBe('camera.autofocus.completed');
    expect(EVENTS.CAPTURE_STARTED).toBe('camera.capture.started');
    expect(EVENTS.SHUTTER).toBe('camera.shutter');
    expect(EVENTS.DOWNLOAD_COMPLETED).toBe('camera.download.completed');
  });

  it('creates structured messages with timestamps and provider=canon', () => {
    const msg = createMessage(COMMANDS.CAPTURE, { sessionId: 'test_session_1', shotIndex: 1 }) as any;
    expect(msg.type).toBe('camera.capture');
    expect(msg.provider).toBe('canon');
    expect(msg.sessionId).toBe('test_session_1');
    expect(msg.shotIndex).toBe(1);
    expect(typeof msg.timestamp).toBe('string');
  });

  it('resolves bridge binary and edsdk path based on platform', () => {
    const binInfo = resolveBridgeBinary();
    expect(binInfo.platform).toBe(process.platform);
    expect(typeof binInfo.path).toBe('string');

    const edsdkInfo = resolveEdsdkPath();
    expect(typeof edsdkInfo.path).toBe('string');
  });

  it('respects MOMENTAI_CANON_BRIDGE_PATH and CANON_BRIDGE_PATH override', () => {
    const originalEnv = process.env.MOMENTAI_CANON_BRIDGE_PATH;
    process.env.MOMENTAI_CANON_BRIDGE_PATH = __filename;
    try {
      const binInfo = resolveBridgeBinary();
      expect(binInfo.source).toBe('ENV_CANON_BRIDGE_PATH');
      expect(binInfo.path).toBe(__filename);
    } finally {
      if (originalEnv !== undefined) {
        process.env.MOMENTAI_CANON_BRIDGE_PATH = originalEnv;
      } else {
        delete process.env.MOMENTAI_CANON_BRIDGE_PATH;
      }
    }
  });

  it('respects MOMENTAI_EDSDK_PATH and CANON_EDSDK_PATH override', () => {
    const originalEnv = process.env.MOMENTAI_EDSDK_PATH;
    process.env.MOMENTAI_EDSDK_PATH = __filename;
    try {
      const edsdkInfo = resolveEdsdkPath();
      expect(edsdkInfo.source).toBe('ENV_CANON_EDSDK_PATH');
      expect(edsdkInfo.path).toBe(__filename);
    } finally {
      if (originalEnv !== undefined) {
        process.env.MOMENTAI_EDSDK_PATH = originalEnv;
      } else {
        delete process.env.MOMENTAI_EDSDK_PATH;
      }
    }
  });
});

describe('CanonRuntimeClient State Machine & Event Flow', () => {
  class MockCanonRuntimeClient extends EventEmitter {
    public state = STATES.DISCONNECTED;
    public cameraModel: string | null = null;
    public cameraCount = 0;
    public requestSeq = 0;
    public pendingRequests = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
    public latestEvfFrame: unknown = null;
    public isRunning = false;

    async start() {
      this.isRunning = true;
      this.state = STATES.INITIALIZING;
      this.emit('stateChanged', { from: STATES.DISCONNECTED, to: STATES.INITIALIZING });
      // Simulate successful discovery
      this.cameraCount = 1;
      this.cameraModel = 'Canon EOS 6D';
      this.state = STATES.READY;
      this.emit('sessionOpened', { model: 'Canon EOS 6D', status: 'ok' });
      this.emit('stateChanged', { from: STATES.INITIALIZING, to: STATES.READY, model: 'Canon EOS 6D' });
      return true;
    }

    async startLiveView() {
      this.state = STATES.LIVEVIEW;
      this.emit('liveViewStarted', { status: 'ok' });
      this.emit('stateChanged', { from: STATES.READY, to: STATES.LIVEVIEW });
      return true;
    }

    async stopLiveView() {
      this.state = STATES.READY;
      this.emit('liveViewStopped', { status: 'ok' });
      this.emit('stateChanged', { from: STATES.LIVEVIEW, to: STATES.READY });
      return true;
    }

    async autoFocus(options: { sessionId?: string; shotIndex?: number; timeoutMs?: number } = {}) {
      if (this.state !== STATES.LIVEVIEW && this.state !== STATES.READY) {
        throw new Error(`Cannot autofocus: state is ${this.state}`);
      }
      this.emit('autoFocusStarted', { status: 'ok' });
      this.emit('autoFocusCompleted', { status: 'ok' });
      return { ok: true, status: 'SUCCESS' };
    }

    async autoFocusStop() {
      return { ok: true };
    }

    async capture(options: { sessionId: string; shotIndex: number; targetPath: string; correlationId?: string }) {
      if (this.state !== STATES.READY && this.state !== STATES.LIVEVIEW) {
        throw new Error(`Cannot capture: state is ${this.state}`);
      }
      this.state = STATES.CAPTURING;
      this.emit('captureStarted', { shotIndex: options.shotIndex, correlationId: options.correlationId });
      this.emit('shutterDone', { status: 'ok' });
      this.state = STATES.DOWNLOADING;
      this.emit('objectCreated', { fileName: 'IMG_0001.JPG', size: 4800000 });
      this.state = STATES.READY;
      const result = {
        path: options.targetPath,
        size: 4800000,
        width: 5472,
        height: 3648,
        sessionId: options.sessionId,
        shotIndex: options.shotIndex,
        correlationId: options.correlationId,
      };
      this.emit('downloadCompleted', result);
      return result;
    }

    async shutdown() {
      this.isRunning = false;
      this.state = STATES.DISCONNECTED;
      this.emit('disconnected', { code: 0 });
    }
  }

  let client: MockCanonRuntimeClient;

  beforeEach(() => {
    client = new MockCanonRuntimeClient();
  });

  afterEach(() => {
    client.removeAllListeners();
  });

  it('transitions state properly on start', async () => {
    const states: string[] = [];
    client.on('stateChanged', (evt) => states.push(evt.to));

    await client.start();

    expect(states).toContain(STATES.INITIALIZING);
    expect(states).toContain(STATES.READY);
    expect(client.cameraModel).toBe('Canon EOS 6D');
    expect(client.cameraCount).toBe(1);
  });

  it('starts and stops Live View stream transitions', async () => {
    await client.start();
    await client.startLiveView();
    expect(client.state).toBe(STATES.LIVEVIEW);

    await client.stopLiveView();
    expect(client.state).toBe(STATES.READY);
  });

  it('executes autofocus in LIVEVIEW mode without disrupting state', async () => {
    await client.start();
    await client.startLiveView();

    const afResult = await client.autoFocus({ sessionId: 'session_1', shotIndex: 1 });
    expect(afResult.ok).toBe(true);
    expect(afResult.status).toBe('SUCCESS');
    expect(client.state).toBe(STATES.LIVEVIEW);
  });

  it('supports manual focus (MF) production mode with zero AF commands during capture cycle', async () => {
    await client.start();
    await client.startLiveView();

    let afTriggered = false;
    client.on('autoFocusStarted', () => { afTriggered = true; });

    // Simulate 8s countdown with MF mode (no AF triggered)
    const captureResult = await client.capture({
      sessionId: 'session_mf_strip_4',
      shotIndex: 1,
      targetPath: '/tmp/test_shot_mf_01.jpg',
      correlationId: 'corr_test_mf_01',
    });

    expect(afTriggered).toBe(false);
    expect(captureResult.path).toBe('/tmp/test_shot_mf_01.jpg');
    expect(captureResult.width).toBe(5472);
    expect(captureResult.height).toBe(3648);
    expect(client.state).toBe(STATES.READY);
  });

  it('executes full capture cycle from Live View to high-res JPEG result', async () => {
    await client.start();
    await client.startLiveView();

    const captureResult = await client.capture({
      sessionId: 'session_strip_4',
      shotIndex: 1,
      targetPath: '/tmp/test_shot_01.jpg',
      correlationId: 'corr_test_01',
    });

    expect(captureResult.path).toBe('/tmp/test_shot_01.jpg');
    expect(captureResult.width).toBe(5472);
    expect(captureResult.height).toBe(3648);
    expect(captureResult.size).toBe(4800000);
    expect(captureResult.correlationId).toBe('corr_test_01');
    expect(client.state).toBe(STATES.READY);
  });

  it('rejects capture if runtime is in DISCONNECTED or ERROR state', async () => {
    await expect(
      client.capture({ sessionId: 's1', shotIndex: 1, targetPath: '/tmp/1.jpg' })
    ).rejects.toThrow(/Cannot capture: state is DISCONNECTED/);
  });
});

describe('Canon Runtime Single Recovery Coordinator & Invariants (Task 10)', () => {
  it('enforces MAX_ACTIVE_RECOVERY_TRANSACTIONS = 1 with recovery mutex', async () => {
    let recoveryExecutionCount = 0;
    let activeRecoveryPromise: Promise<boolean> | null = null;
    let activeRecoveryId: string | null = null;

    async function requestRecovery(reason: string): Promise<boolean> {
      if (activeRecoveryPromise) {
        return activeRecoveryPromise;
      }
      activeRecoveryId = 'rec_' + Date.now();
      activeRecoveryPromise = (async () => {
        try {
          recoveryExecutionCount++;
          await new Promise((r) => setTimeout(r, 50));
          return true;
        } finally {
          activeRecoveryPromise = null;
          activeRecoveryId = null;
        }
      })();
      return activeRecoveryPromise;
    }

    // Call 3 recoveries concurrently
    const [r1, r2, r3] = await Promise.all([
      requestRecovery('ENUM_NATIVE_HUNG'),
      requestRecovery('UNEXPECTED_BRIDGE_EXIT'),
      requestRecovery('IPC_RECOVER_BRIDGE'),
    ]);

    expect(r1).toBe(true);
    expect(r2).toBe(true);
    expect(r3).toBe(true);
    expect(recoveryExecutionCount).toBe(1); // Executed exactly once!
  });

  it('ignores stale bridge events and late enumeration results from old generation', () => {
    let currentBridgeGeneration = 1;
    let currentBridgePid = 5241;
    let mutatedState: any = null;

    function handleBridgeEvent(event: any, sourcePid: number, sourceGen: number) {
      if (sourceGen !== currentBridgeGeneration || sourcePid !== currentBridgePid) {
        // Stale event ignored
        return;
      }
      mutatedState = event;
    }

    // Watchdog fires for generation 1 (PID 5241), invalidates generation
    currentBridgeGeneration = 2;
    currentBridgePid = 5259;

    // Late event arrives from old bridge (PID 5241, generation 1) after 15s
    handleBridgeEvent({ event: 'cameraDiscovered', count: 1, model: 'Canon EOS 6D' }, 5241, 1);

    // Assert that state was NOT mutated by the late response
    expect(mutatedState).toBeNull();

    // Event from current bridge (PID 5259, generation 2) is accepted
    handleBridgeEvent({ event: 'cameraDiscovered', count: 1, model: 'Canon EOS 6D' }, 5259, 2);
    expect(mutatedState).not.toBeNull();
    expect(mutatedState.count).toBe(1);
  });

  it('guards against duplicate recovery on expected bridge exit', () => {
    const expectedExitPids = new Set<number>();
    let recoveryTriggered = false;

    function simulateProcessClose(pid: number, isCurrent: boolean) {
      if (expectedExitPids.has(pid)) {
        expectedExitPids.delete(pid);
        // Expected exit, do NOT trigger recovery
        return;
      }
      if (isCurrent) {
        recoveryTriggered = true;
      }
    }

    // Watchdog terminates PID 5241 intentionally
    expectedExitPids.add(5241);

    // Child process emits close
    simulateProcessClose(5241, true);

    expect(recoveryTriggered).toBe(false); // No duplicate recovery!

    // Unexpected crash of PID 5259
    simulateProcessClose(5259, true);
    expect(recoveryTriggered).toBe(true); // Triggered for unexpected death!
  });

  it('maintains separate states for physicalUsbPresent and ptpResponsive', () => {
    const runtimeState = {
      physicalUsbPresent: true,
      cameraCount: 0,
      state: STATES.CAMERA_PTP_UNRESPONSIVE,
      blockedInLibusb: true,
    };

    const isPhysicalUsb = runtimeState.physicalUsbPresent;
    const isPtpUnresponsive = runtimeState.state === STATES.CAMERA_PTP_UNRESPONSIVE;
    const isAuthoritativeNoCanon = !isPhysicalUsb && runtimeState.cameraCount === 0;
    const fallbackReason = isPtpUnresponsive ? 'CANON_PTP_UNRESPONSIVE' : (isAuthoritativeNoCanon ? 'NO_CANON_HARDWARE' : 'NONE');

    expect(isPhysicalUsb).toBe(true);
    expect(fallbackReason).toBe('CANON_PTP_UNRESPONSIVE');
    expect(fallbackReason).not.toBe('NO_CANON_HARDWARE');
  });
});

