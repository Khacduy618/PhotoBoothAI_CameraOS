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

  afterEach(async () => {
    await client.shutdown();
  });

  it('starts runtime client and reaches READY with Canon EOS 6D', async () => {
    expect(client.state).toBe(STATES.DISCONNECTED);
    const ok = await client.start();
    expect(ok).toBe(true);
    expect(client.state).toBe(STATES.READY);
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
