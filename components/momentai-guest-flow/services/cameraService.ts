import { CameraSettings } from '../types';

export class CameraService {
  private mediaStream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private audioCtx: AudioContext | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];

  private settings: CameraSettings = {
    iso: 400,
    shutterSpeed: '1/125',
    aperture: 'f/5.6',
    focusMode: 'AI SERVO',
    connected: true,
    model: 'Canon EOS 6D (DSLR-EDSDK)',
    batteryLevel: 94,
    temperature: 36,
    shutterCount: 14820,
    mode: 'webcam',
    liveViewRunning: true,
  };

  constructor() {
    this.initAudioContext();
  }

  private initAudioContext() {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.audioCtx = new AudioCtx();
      }
    } catch {
      console.warn('AudioContext not supported');
    }
  }

  public getSettings(): CameraSettings {
    return { ...this.settings };
  }

  public updateSettings(partial: Partial<CameraSettings>) {
    this.settings = { ...this.settings, ...partial };
  }

  public async startWebcam(): Promise<boolean> {
    if (typeof window !== 'undefined' && (window as unknown as { momentai?: { guest?: { camera?: { status: () => Promise<unknown> } } } }).momentai?.guest?.camera?.status) {
      try {
        await (window as unknown as { momentai: { guest: { camera: { status: () => Promise<unknown> } } } }).momentai.guest.camera.status();
      } catch (err) {
        console.warn('IPC camera status call failed:', err);
      }
    }
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1920 }, height: { ideal: 1080 }, facingMode: 'user' },
          audio: false,
        });
        this.mediaStream = stream;
        this.settings.connected = true;
        this.settings.mode = 'webcam';
        this.settings.liveViewRunning = true;
        return true;
      }
    } catch (err) {
      console.warn('Webcam permission denied or unavailable, switching to Canon 6D Simulator', err);
      this.settings.mode = 'simulator';
      this.settings.connected = true;
      this.settings.liveViewRunning = true;
      return false;
    }
    return false;
  }

  public stopWebcam() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
  }

  public attachToVideo(videoEl: HTMLVideoElement) {
    this.videoElement = videoEl;
    if (this.mediaStream) {
      videoEl.srcObject = this.mediaStream;
      videoEl.play().catch((e) => console.log('Autoplay issue:', e));
    }
  }

  public playBeepSound(pitch: number = 800, durationMs: number = 100) {
    if (!this.audioCtx) return;
    try {
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(pitch, this.audioCtx.currentTime);
      gain.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + durationMs / 1000);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + durationMs / 1000);
    } catch (e) {
      console.log('Audio play error:', e);
    }
  }

  public playShutterSound() {
    if (!this.audioCtx) return;
    try {
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      // Simulate double DSLR mechanical shutter click
      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.12);

      gain.gain.setValueAtTime(0.8, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
    } catch (e) {
      console.log('Shutter sound error:', e);
    }
  }

  public async capturePhoto(shotIndex: number, sessionId?: string): Promise<string> {
    this.playShutterSound();

    if (typeof window !== 'undefined' && (window as unknown as { momentai?: { guest?: { camera?: { capture: (ctx: unknown) => Promise<unknown> } } } }).momentai?.guest?.camera?.capture) {
      try {
        await (window as unknown as { momentai: { guest: { camera: { capture: (ctx: unknown) => Promise<unknown> } } } }).momentai.guest.camera.capture({
          sessionId: sessionId || 'desktop_session',
          shotIndex: shotIndex + 1,
          correlationId: `capture_${Date.now()}_${shotIndex + 1}`,
        });
      } catch (err) {
        console.warn('IPC camera capture call failed:', err);
      }
    }

    // Increment shutter count
    this.settings.shutterCount += 1;

    // If webcam active and video element loaded:
    if (this.mediaStream && this.videoElement && this.videoElement.readyState >= 2) {
      const canvas = document.createElement('canvas');
      canvas.width = this.videoElement.videoWidth || 1920;
      canvas.height = this.videoElement.videoHeight || 1080;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        // Mirror webcam horizontally for intuitive preview
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(this.videoElement, 0, 0, canvas.width, canvas.height);

        // Reset transform
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        console.log(`[CameraService] Captured photo resolution: ${canvas.width}x${canvas.height}`);

        return canvas.toDataURL('image/jpeg', 0.98);
      }
    }

    // Fallback: Generate ultra-realistic Canon 6D simulated snapshot photo
    return this.generateSimulatedPhoto(shotIndex);
  }

  private generateSimulatedPhoto(shotIndex: number): string {
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1280;
    const ctx = canvas.getContext('2d')!;

    // Dynamic color gradient based on shot index
    const gradients = [
      ['#3b82f6', '#8b5cf6', '#ec4899'],
      ['#f59e0b', '#ef4444', '#7c3aed'],
      ['#10b981', '#06b6d4', '#3b82f6'],
      ['#ec4899', '#f43f5e', '#fb923c'],
      ['#6366f1', '#a855f7', '#d946ef'],
      ['#14b8a6', '#0ea5e9', '#6366f1'],
      ['#f97316', '#eab308', '#84cc16'],
      ['#0284c7', '#2563eb', '#7c3aed'],
    ];

    const currentGrad = gradients[shotIndex % gradients.length];
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, currentGrad[0]);
    grad.addColorStop(0.5, currentGrad[1]);
    grad.addColorStop(1, currentGrad[2]);

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Vignette
    const vig = ctx.createRadialGradient(
      canvas.width / 2, canvas.height / 2, canvas.width * 0.3,
      canvas.width / 2, canvas.height / 2, canvas.width * 0.7
    );
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Decorative party lights & bokeh circles
    for (let i = 0; i < 24; i++) {
      const bx = (Math.sin(i * 1.5 + shotIndex) * 0.4 + 0.5) * canvas.width;
      const by = (Math.cos(i * 2.1 + shotIndex) * 0.4 + 0.5) * canvas.height;
      const br = 40 + Math.random() * 80;

      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${0.1 + (i % 3) * 0.08})`;
      ctx.fill();
    }

    // Silhouette / Portrait subject illustration
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2 + 100);

    // Head
    ctx.beginPath();
    ctx.arc(0, -220, 120, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 20;
    ctx.fill();

    // Shoulders
    ctx.beginPath();
    ctx.ellipse(0, 120, 280, 180, 0, Math.PI, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fill();
    ctx.restore();

    return canvas.toDataURL('image/jpeg', 0.95);
  }

  public async autofocus(sessionId?: string): Promise<boolean> {
    this.playBeepSound(1200, 80);
    if (typeof window !== 'undefined' && (window as unknown as { momentai?: { guest?: { camera?: { autofocus: (ctx: unknown) => Promise<unknown> } } } }).momentai?.guest?.camera?.autofocus) {
      try {
        await (window as unknown as { momentai: { guest: { camera: { autofocus: (ctx: unknown) => Promise<unknown> } } } }).momentai.guest.camera.autofocus({
          sessionId: sessionId || 'desktop_session',
        });
      } catch (err) {
        console.warn('IPC autofocus failed:', err);
      }
    }
    return true;
  }

  public async startSessionRecording(sessionId?: string): Promise<boolean> {
    if (typeof window !== 'undefined' && (window as unknown as { momentai?: { guest?: { camera?: { startRecording: (ctx: unknown) => Promise<unknown> } } } }).momentai?.guest?.camera?.startRecording) {
      try {
        await (window as unknown as { momentai: { guest: { camera: { startRecording: (ctx: unknown) => Promise<unknown> } } } }).momentai.guest.camera.startRecording({
          sessionId: sessionId || 'desktop_session',
        });
      } catch (err) {
        console.warn('IPC startRecording failed:', err);
      }
    }

    if (this.mediaStream && typeof MediaRecorder !== 'undefined') {
      try {
        this.recordedChunks = [];
        const options = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? { mimeType: 'video/webm;codecs=vp9' }
          : MediaRecorder.isTypeSupported('video/webm')
          ? { mimeType: 'video/webm' }
          : undefined;
        this.mediaRecorder = new MediaRecorder(this.mediaStream, options);
        this.mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            this.recordedChunks.push(event.data);
          }
        };
        this.mediaRecorder.start(100);
        return true;
      } catch (e) {
        console.warn('MediaRecorder start error:', e);
      }
    }
    return false;
  }

  public async stopSessionRecording(sessionId?: string): Promise<Blob | null> {
    if (typeof window !== 'undefined' && (window as unknown as { momentai?: { guest?: { camera?: { stopRecording: (ctx: unknown) => Promise<unknown> } } } }).momentai?.guest?.camera?.stopRecording) {
      try {
        await (window as unknown as { momentai: { guest: { camera: { stopRecording: (ctx: unknown) => Promise<unknown> } } } }).momentai.guest.camera.stopRecording({
          sessionId: sessionId || 'desktop_session',
        });
      } catch (err) {
        console.warn('IPC stopRecording failed:', err);
      }
    }

    return new Promise((resolve) => {
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.onstop = () => {
          const blob = new Blob(this.recordedChunks, { type: this.mediaRecorder?.mimeType || 'video/webm' });
          this.mediaRecorder = null;
          resolve(blob);
        };
        this.mediaRecorder.stop();
      } else {
        resolve(null);
      }
    });
  }
}

export const cameraService = new CameraService();
