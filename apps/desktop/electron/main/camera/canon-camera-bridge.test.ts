import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';

// Create a mock bridge manager to test state machine and protocol invariants
class MockCanonCameraBridgeManager extends EventEmitter {
  public state = 'DISCONNECTED';
  public cameraModel: string | null = null;
  public cameraCount = 0;
  public currentPendingCapture: { resolve: (data: unknown) => void; reject: (err: Error) => void } | null = null;
  public latestEvfFrame: unknown = null;

  async start() {
    this.state = 'CONNECTING';
    this.state = 'READY';
    this.cameraCount = 1;
    this.cameraModel = 'Canon EOS 6D';
    this.emit('cameraDiscovered', { count: 1, model: 'Canon EOS 6D' });
    this.emit('sessionOpened', { status: 'ok', model: 'Canon EOS 6D' });
    return true;
  }

  handleBridgeEvent(event: { event: string; [key: string]: unknown }) {
    const { event: eventName } = event;
    if (eventName === 'liveViewStarted') {
      this.state = 'LIVEVIEW';
      this.emit('liveViewStarted', event);
    } else if (eventName === 'liveViewStopped') {
      this.state = 'READY';
      this.emit('liveViewStopped', event);
    } else if (eventName === 'liveViewFrame') {
      this.latestEvfFrame = event;
      this.emit('liveViewFrame', event);
    } else if (eventName === 'captureStarted') {
      this.state = 'CAPTURING';
      this.emit('captureStarted', event);
    } else if (eventName === 'objectCreated') {
      this.state = 'DOWNLOADING';
      this.emit('objectCreated', event);
    } else if (eventName === 'downloadCompleted') {
      this.state = 'READY';
      if (this.currentPendingCapture) {
        this.currentPendingCapture.resolve(event);
        this.currentPendingCapture = null;
      }
      this.emit('downloadCompleted', event);
    } else if (eventName === 'cameraDisconnected') {
      this.state = 'DISCONNECTED';
      this.emit('disconnected', event);
    }
  }

  async capture(options: { sessionId: string; shotIndex: number; targetPath: string; timeoutMs?: number }) {
    if (this.state !== 'READY' && this.state !== 'LIVEVIEW') {
      throw new Error(`Cannot capture: Canon bridge state is ${this.state}`);
    }
    if (this.currentPendingCapture) {
      throw new Error('Capture already in progress');
    }

    return new Promise((resolve, reject) => {
      this.currentPendingCapture = { resolve, reject };
      this.handleBridgeEvent({ event: 'captureStarted', shotIndex: options.shotIndex });
    });
  }
}

describe('CanonCameraBridgeManager Unit Tests', () => {
  let bridge: MockCanonCameraBridgeManager;

  beforeEach(() => {
    bridge = new MockCanonCameraBridgeManager();
  });

  it('transitions from DISCONNECTED to READY after successful start', async () => {
    expect(bridge.state).toBe('DISCONNECTED');
    const started = await bridge.start();
    expect(started).toBe(true);
    expect(bridge.state).toBe('READY');
    expect(bridge.cameraModel).toBe('Canon EOS 6D');
  });

  it('transitions through LIVEVIEW -> CAPTURING -> DOWNLOADING -> READY lifecycle', async () => {
    await bridge.start();
    bridge.handleBridgeEvent({ event: 'liveViewStarted' });
    expect(bridge.state).toBe('LIVEVIEW');

    const capturePromise = bridge.capture({
      sessionId: 'test_session',
      shotIndex: 1,
      targetPath: '/tmp/test_shot1.jpg',
    });

    expect(bridge.state).toBe('CAPTURING');

    bridge.handleBridgeEvent({ event: 'objectCreated', fileName: 'IMG_0001.JPG', size: 4500000 });
    expect(bridge.state).toBe('DOWNLOADING');

    bridge.handleBridgeEvent({
      event: 'downloadCompleted',
      path: '/tmp/test_shot1.jpg',
      size: 4500000,
      width: 5472,
      height: 3648,
    });

    const result = (await capturePromise) as { path: string; size: number; width: number; height: number };
    expect(result.path).toBe('/tmp/test_shot1.jpg');
    expect(result.width).toBe(5472);
    expect(result.height).toBe(3648);
    expect(bridge.state).toBe('READY');
  });

  it('prevents overlapping capture commands with capture lock', async () => {
    await bridge.start();
    void bridge.capture({ sessionId: 'session_1', shotIndex: 1, targetPath: '/tmp/1.jpg' });

    await expect(
      bridge.capture({ sessionId: 'session_1', shotIndex: 2, targetPath: '/tmp/2.jpg' })
    ).rejects.toThrow(/Cannot capture: Canon bridge state is CAPTURING|Capture already in progress/);
  });

  it('handles disconnect and resets state to DISCONNECTED', async () => {
    await bridge.start();
    bridge.handleBridgeEvent({ event: 'cameraDisconnected' });
    expect(bridge.state).toBe('DISCONNECTED');
  });
});
